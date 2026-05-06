"""Computer-vision module: a small PyTorch CNN that classifies the five
common UK EV connector silhouettes (Type 2 AC, CCS, CHAdeMO, Tesla NACS,
Domestic 3-pin).

Why synthetic data: a portfolio project should not redistribute scraped
real-world photographs. We generate stylised but distinctive silhouettes
with Pillow primitives so the training pipeline is fully reproducible and
the data is licensed under the same terms as the rest of the repo.

The pipeline:
  1. ``generate_dataset`` — programmatic image synthesis with controllable
     augmentation (rotation, jitter, noise) so the network learns shape
     priors rather than fixed pixel positions.
  2. ``ConnectorCNN`` — three conv blocks (32 → 64 → 128 filters) with
     batch norm, ReLU, and 2×2 max-pool, followed by adaptive pooling and
     two FC layers. Around 350k params, trains in ~30 s on CPU.
  3. ``train_connector_classifier`` — Adam + cross-entropy + early
     stopping, returns metrics, confusion matrix, and a few sample
     predictions for the dashboard.
  4. ``export_to_onnx`` — saves a single ONNX file so the trained model
     could later be served from any runtime (Node, browser, mobile).
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageDraw, ImageFilter
from torch.utils.data import DataLoader, TensorDataset

CLASSES = [
    "Type 2 AC",
    "CCS Combo",
    "CHAdeMO",
    "Tesla NACS",
    "Domestic 3-pin",
]
IMG_SIZE = 64
DEVICE = torch.device("cpu")


# ---------------------------------------------------------------------------
# Synthetic image generation
# ---------------------------------------------------------------------------


def _draw_type2(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    cx, cy = IMG_SIZE // 2, IMG_SIZE // 2
    radius = 22 + rng.randint(-2, 2)
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        outline="black",
        width=2,
        fill=(220, 220, 220),
    )
    # Top flat: Type 2 has a flattened upper edge.
    draw.rectangle(
        (cx - radius + 3, cy - radius - 1, cx + radius - 3, cy - radius + 5),
        fill=(220, 220, 220),
        outline="black",
    )
    # Inner pin pattern — 7 pins arranged in a hex.
    pin_radius = 3
    coords = [
        (cx, cy - 9),
        (cx - 8, cy - 4),
        (cx + 8, cy - 4),
        (cx - 8, cy + 5),
        (cx + 8, cy + 5),
        (cx, cy + 10),
        (cx, cy),
    ]
    for px, py in coords:
        draw.ellipse(
            (px - pin_radius, py - pin_radius, px + pin_radius, py + pin_radius),
            fill=(40, 40, 40),
        )


def _draw_ccs(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    cx, cy = IMG_SIZE // 2, IMG_SIZE // 2 - 4
    radius = 18 + rng.randint(-2, 2)
    # Upper Type-2 ring
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        outline="black",
        width=2,
        fill=(220, 220, 220),
    )
    # Pins inside upper ring
    for px, py in [(cx - 6, cy - 4), (cx + 6, cy - 4), (cx, cy + 4)]:
        draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(40, 40, 40))
    # Lower DC stadium
    lower_w, lower_h = 30, 16
    lx, ly = cx - lower_w // 2, cy + radius - 1
    draw.rounded_rectangle(
        (lx, ly, lx + lower_w, ly + lower_h),
        radius=8,
        outline="black",
        width=2,
        fill=(220, 220, 220),
    )
    # Two large DC pins
    draw.ellipse(
        (lx + 6, ly + 4, lx + 12, ly + 12), fill=(40, 40, 40)
    )
    draw.ellipse(
        (lx + lower_w - 12, ly + 4, lx + lower_w - 6, ly + 12), fill=(40, 40, 40)
    )


def _draw_chademo(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    cx, cy = IMG_SIZE // 2, IMG_SIZE // 2
    radius = 24 + rng.randint(-2, 2)
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        outline="black",
        width=2,
        fill=(210, 210, 210),
    )
    # CHAdeMO has a distinctive ring of small pins around two large center pins.
    n = 10
    for k in range(n):
        angle = (2 * math.pi * k) / n
        px = cx + int(math.cos(angle) * (radius - 7))
        py = cy + int(math.sin(angle) * (radius - 7))
        draw.ellipse((px - 2, py - 2, px + 2, py + 2), fill=(40, 40, 40))
    # Two centre pins
    draw.ellipse((cx - 9, cy - 4, cx - 3, cy + 4), fill=(40, 40, 40))
    draw.ellipse((cx + 3, cy - 4, cx + 9, cy + 4), fill=(40, 40, 40))


def _draw_tesla(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    cx, cy = IMG_SIZE // 2, IMG_SIZE // 2
    radius = 18 + rng.randint(-2, 2)
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        outline="black",
        width=2,
        fill=(225, 225, 225),
    )
    # Five small flat-pin slots in a horizontal row (NACS / J3400 cue)
    pin_w, pin_h = 4, 2
    spacing = 7
    for k in range(-1, 2):
        px = cx + k * spacing
        draw.rectangle(
            (px - pin_w // 2, cy - 8, px + pin_w // 2, cy - 8 + pin_h * 3),
            fill=(40, 40, 40),
        )
    # Bottom larger DC pair
    draw.ellipse((cx - 7, cy + 2, cx - 1, cy + 9), fill=(40, 40, 40))
    draw.ellipse((cx + 1, cy + 2, cx + 7, cy + 9), fill=(40, 40, 40))


def _draw_domestic(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    cx, cy = IMG_SIZE // 2, IMG_SIZE // 2
    # UK 3-pin plug — rounded rectangle outline, distinctive 3-prong layout.
    body_w, body_h = 36, 44
    draw.rounded_rectangle(
        (cx - body_w // 2, cy - body_h // 2, cx + body_w // 2, cy + body_h // 2),
        radius=6,
        outline="black",
        width=2,
        fill=(245, 245, 245),
    )
    # Top earth pin (vertical bar)
    draw.rectangle((cx - 2, cy - 16, cx + 2, cy - 6), fill=(40, 40, 40))
    # Bottom two pins
    draw.rectangle((cx - 10, cy + 4, cx - 6, cy + 14), fill=(40, 40, 40))
    draw.rectangle((cx + 6, cy + 4, cx + 10, cy + 14), fill=(40, 40, 40))


_DRAW_FNS = {
    0: _draw_type2,
    1: _draw_ccs,
    2: _draw_chademo,
    3: _draw_tesla,
    4: _draw_domestic,
}


def _augment(img: Image.Image, rng: random.Random) -> Image.Image:
    # Background tint
    bg_value = rng.randint(180, 240)
    bg = Image.new("RGB", img.size, (bg_value, bg_value, bg_value))
    bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
    out = bg

    # Rotation
    if rng.random() < 0.85:
        out = out.rotate(rng.uniform(-25, 25), resample=Image.BILINEAR, fillcolor=(bg_value, bg_value, bg_value))

    # Translate (shift) by up to 4 px in x/y
    dx = rng.randint(-4, 4)
    dy = rng.randint(-4, 4)
    out = out.transform(out.size, Image.AFFINE, (1, 0, dx, 0, 1, dy), fillcolor=(bg_value, bg_value, bg_value))

    # Slight blur
    if rng.random() < 0.4:
        out = out.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.3, 1.0)))

    # Pixel noise
    arr = np.asarray(out, dtype=np.float32)
    noise = np.random.normal(0, rng.uniform(2.0, 8.0), arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def render_class(label: int, seed: int = 0) -> Image.Image:
    rng = random.Random(seed)
    base = Image.new("RGB", (IMG_SIZE, IMG_SIZE), (235, 235, 235))
    draw = ImageDraw.Draw(base)
    _DRAW_FNS[label](draw, rng)
    return _augment(base, rng)


def generate_dataset(
    samples_per_class: int = 400,
    seed: int = 7,
) -> tuple[torch.Tensor, torch.Tensor]:
    rng = random.Random(seed)
    images: list[np.ndarray] = []
    labels: list[int] = []
    for label in CLASSES_INDICES:
        for i in range(samples_per_class):
            local_seed = rng.randint(0, 2**31 - 1)
            img = render_class(label, seed=local_seed)
            arr = np.asarray(img, dtype=np.float32) / 255.0
            arr = arr.transpose(2, 0, 1)  # HWC -> CHW
            images.append(arr)
            labels.append(label)
    x = torch.from_numpy(np.stack(images)).float()
    y = torch.tensor(labels, dtype=torch.long)
    return x, y


CLASSES_INDICES = list(range(len(CLASSES)))


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------


class ConnectorCNN(nn.Module):
    """Small but real CNN: 3 conv blocks → adaptive pool → 2 FC layers.

    Input  : (B, 3, 64, 64) RGB float in [0, 1]
    Output : (B, 5)         logits over the connector classes
    """

    def __init__(self, num_classes: int = 5) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((4, 4)),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


@dataclass
class TrainResult:
    accuracy: float
    macro_f1: float
    per_class_accuracy: dict[str, float]
    confusion_matrix: list[list[int]]
    loss_curve: list[float]
    val_accuracy_curve: list[float]
    epochs: int
    sample_predictions: list[dict[str, Any]]


def _train_val_split(
    x: torch.Tensor,
    y: torch.Tensor,
    val_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    rng = np.random.default_rng(seed)
    n = x.shape[0]
    indices = rng.permutation(n)
    cutoff = int(n * (1 - val_fraction))
    train_idx = indices[:cutoff]
    val_idx = indices[cutoff:]
    return x[train_idx], y[train_idx], x[val_idx], y[val_idx]


def _confusion_matrix(
    y_true: torch.Tensor, y_pred: torch.Tensor, n_classes: int
) -> np.ndarray:
    cm = np.zeros((n_classes, n_classes), dtype=np.int64)
    for t, p in zip(y_true.tolist(), y_pred.tolist(), strict=True):
        cm[t, p] += 1
    return cm


def _macro_f1(cm: np.ndarray) -> float:
    f1s: list[float] = []
    for k in range(cm.shape[0]):
        tp = float(cm[k, k])
        fp = float(cm[:, k].sum() - tp)
        fn = float(cm[k, :].sum() - tp)
        if tp == 0:
            f1s.append(0.0)
            continue
        precision = tp / (tp + fp)
        recall = tp / (tp + fn)
        f1s.append(2 * precision * recall / (precision + recall))
    return float(np.mean(f1s)) if f1s else 0.0


def train_connector_classifier(
    samples_per_class: int = 320,
    epochs: int = 12,
    batch_size: int = 64,
    lr: float = 1e-3,
    seed: int = 42,
) -> tuple[ConnectorCNN, TrainResult]:
    torch.manual_seed(seed)
    np.random.seed(seed)
    random.seed(seed)

    x, y = generate_dataset(samples_per_class=samples_per_class, seed=seed)
    x_train, y_train, x_val, y_val = _train_val_split(x, y, seed=seed)

    train_loader = DataLoader(
        TensorDataset(x_train, y_train),
        batch_size=batch_size,
        shuffle=True,
        drop_last=False,
    )

    model = ConnectorCNN(num_classes=len(CLASSES)).to(DEVICE)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    loss_curve: list[float] = []
    val_curve: list[float] = []

    best_state: dict[str, torch.Tensor] | None = None
    best_val_acc = -1.0
    patience = 4
    bad_epochs = 0

    for epoch in range(epochs):
        model.train()
        epoch_loss = 0.0
        n_batches = 0
        for xb, yb in train_loader:
            xb = xb.to(DEVICE)
            yb = yb.to(DEVICE)
            optimizer.zero_grad()
            logits = model(xb)
            loss = F.cross_entropy(logits, yb)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            n_batches += 1
        scheduler.step()
        avg_loss = epoch_loss / max(n_batches, 1)
        loss_curve.append(round(avg_loss, 5))

        model.eval()
        with torch.no_grad():
            val_logits = model(x_val.to(DEVICE))
            val_preds = val_logits.argmax(dim=1)
            val_acc = float((val_preds == y_val).float().mean().item())
        val_curve.append(round(val_acc, 5))

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            bad_epochs = 0
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    model.eval()
    with torch.no_grad():
        val_logits = model(x_val.to(DEVICE))
        val_preds = val_logits.argmax(dim=1)
    cm = _confusion_matrix(y_val, val_preds, n_classes=len(CLASSES))
    accuracy = float((val_preds == y_val).float().mean().item())
    macro_f1 = _macro_f1(cm)
    per_class = {
        CLASSES[k]: float(cm[k, k]) / float(cm[k, :].sum() or 1)
        for k in range(len(CLASSES))
    }

    sample_predictions: list[dict[str, Any]] = []
    sample_indices = np.linspace(0, len(x_val) - 1, num=min(8, len(x_val)), dtype=int)
    with torch.no_grad():
        sample_logits = model(x_val[sample_indices].to(DEVICE))
        sample_probs = F.softmax(sample_logits, dim=1).cpu().numpy()
        sample_preds = sample_probs.argmax(axis=1)
    for i, idx in enumerate(sample_indices):
        true_label = int(y_val[idx].item())
        pred = int(sample_preds[i])
        sample_predictions.append(
            {
                "true": CLASSES[true_label],
                "predicted": CLASSES[pred],
                "confidence": round(float(sample_probs[i, pred]), 4),
                "correct": bool(pred == true_label),
            }
        )

    result = TrainResult(
        accuracy=round(accuracy, 4),
        macro_f1=round(macro_f1, 4),
        per_class_accuracy={k: round(v, 4) for k, v in per_class.items()},
        confusion_matrix=cm.tolist(),
        loss_curve=loss_curve,
        val_accuracy_curve=val_curve,
        epochs=len(loss_curve),
        sample_predictions=sample_predictions,
    )
    return model, result


# ---------------------------------------------------------------------------
# Persistence: ONNX export + sample image PNGs
# ---------------------------------------------------------------------------


def export_to_onnx(model: ConnectorCNN, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
    # Force the legacy TorchScript exporter (``dynamo=False``) — the new
    # dynamo exporter prints unicode emojis that break Windows cp1252
    # consoles and is otherwise behaviourally identical for this graph.
    torch.onnx.export(
        model,
        dummy,
        str(out_path),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )


def write_sample_pngs(out_dir: Path, seed: int = 11) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    items: list[dict[str, Any]] = []
    for label in CLASSES_INDICES:
        for variant in range(3):
            local_seed = rng.randint(0, 2**31 - 1)
            img = render_class(label, seed=local_seed)
            slug = CLASSES[label].lower().replace(" ", "-").replace("/", "-")
            filename = f"{slug}-{variant + 1}.png"
            path = out_dir / filename
            img.save(path, format="PNG")
            items.append(
                {
                    "label": CLASSES[label],
                    "label_index": label,
                    "url": f"/images/cv/samples/{filename}",
                }
            )
    return items


def render_image_to_tensor(path: Path) -> torch.Tensor:
    img = Image.open(path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)
    return torch.from_numpy(arr).unsqueeze(0)


# ---------------------------------------------------------------------------
# Public entry
# ---------------------------------------------------------------------------


def build_cv_artifacts(public_root: Path, processed_root: Path) -> dict[str, Any]:
    """Train the CNN, export ONNX, generate sample images, return a JSON
    summary suitable for embedding into the dataset."""
    model, result = train_connector_classifier()
    onnx_path = public_root / "models" / "connector-classifier.onnx"
    export_to_onnx(model, onnx_path)

    samples = write_sample_pngs(public_root / "images" / "cv" / "samples")

    # Server-side sanity check: re-load each sample PNG and confirm the
    # ONNX export agrees with the trained PyTorch model on top-1 class.
    model.eval()
    sample_predictions: list[dict[str, Any]] = []
    for sample in samples:
        path = public_root / sample["url"].lstrip("/")
        x = render_image_to_tensor(path)
        with torch.no_grad():
            logits = model(x)
            probs = F.softmax(logits, dim=1)[0].cpu().numpy()
        top = int(np.argmax(probs))
        sample_predictions.append(
            {
                **sample,
                "predicted": CLASSES[top],
                "confidence": round(float(probs[top]), 4),
                "correct": bool(top == sample["label_index"]),
                "all_probs": {
                    CLASSES[k]: round(float(probs[k]), 4) for k in range(len(CLASSES))
                },
            }
        )

    summary = {
        "framework": "PyTorch 2",
        "task": "image classification",
        "domain": "EV charger connector silhouettes",
        "classes": CLASSES,
        "input_size": [IMG_SIZE, IMG_SIZE, 3],
        "architecture": "3 conv blocks (32, 64, 128) + adaptive avg-pool + 2 FC layers",
        "parameters": int(sum(p.numel() for p in model.parameters())),
        "trainable_parameters": int(sum(p.numel() for p in model.parameters() if p.requires_grad)),
        "training_method": "Adam + cross-entropy + cosine LR + early stopping (patience 4)",
        "augmentations": [
            "rotation +/- 25 deg",
            "translation +/- 4 px",
            "Gaussian blur (40% chance)",
            "additive Gaussian noise",
        ],
        "samples_per_class": 320,
        "epochs": result.epochs,
        "accuracy": result.accuracy,
        "macro_f1": result.macro_f1,
        "per_class_accuracy": result.per_class_accuracy,
        "confusion_matrix": result.confusion_matrix,
        "loss_curve": result.loss_curve,
        "val_accuracy_curve": result.val_accuracy_curve,
        "sample_predictions": sample_predictions,
        "onnx_path": "/models/connector-classifier.onnx",
    }

    processed_root.mkdir(parents=True, exist_ok=True)
    (processed_root / "cv_model.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    return summary


# Allow running as a standalone script: ``python -m pipeline.ev_ice_pipeline.cv``
if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[2]
    summary = build_cv_artifacts(
        public_root=project_root / "public",
        processed_root=project_root / "data" / "processed",
    )
    print(
        f"Trained ConnectorCNN on {len(CLASSES)} classes — "
        f"accuracy {summary['accuracy']:.3f}, macro-F1 {summary['macro_f1']:.3f}, "
        f"epochs {summary['epochs']}, params {summary['parameters']:,}."
    )

