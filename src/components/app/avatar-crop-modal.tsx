"use client";
import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const OUTPUT_SIZE = 512; // square px written to the uploaded file

/** Draw the selected crop region to a square canvas and return a JPEG blob. */
function cropToBlob(src: string, area: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), "image/jpeg", 0.9);
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export function AvatarCropModal({
  src,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  src: string | null;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  // Reset the frame each time a new image is chosen.
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }, [src]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function confirm() {
    if (!src || !area) return;
    const blob = await cropToBlob(src, area);
    onConfirm(blob);
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Crop photo"
      description="Drag to reposition, and zoom to frame your photo."
      busy={busy}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
            Cancel
          </Button>
          <Button onClick={confirm} loading={busy} className="flex-1">
            Set photo
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative h-64 w-full overflow-hidden rounded-none border border-border bg-surface-2">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <label className="flex items-center gap-3">
          <span className="text-label-sm uppercase text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-none bg-border accent-brand"
            aria-label="Zoom"
          />
        </label>
      </div>
    </Modal>
  );
}
