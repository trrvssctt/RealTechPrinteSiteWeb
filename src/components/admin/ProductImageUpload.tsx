import { useState, useCallback } from "react";
import { Upload, X, Star, GripVertical, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProductImage {
  url: string;
  alt: string;
  order: number;
  is_primary: boolean;
}

interface ProductImageUploadProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

export const ProductImageUpload = ({ images, onChange }: ProductImageUploadProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [images]);

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newImage: ProductImage = {
            url: e.target?.result as string,
            alt: file.name,
            order: images.length,
            is_primary: images.length === 0
          };
          onChange([...images, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      const newImage: ProductImage = {
        url: urlInput.trim(),
        alt: "Image produit",
        order: images.length,
        is_primary: images.length === 0
      };
      onChange([...images, newImage]);
      setUrlInput("");
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    // If primary was removed, set first image as primary
    if (images[index].is_primary && newImages.length > 0) {
      newImages[0].is_primary = true;
    }
    onChange(newImages);
  };

  const setPrimary = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      is_primary: i === index
    }));
    onChange(newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    newImages.forEach((img, i) => img.order = i);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Glissez-déposez vos images ici
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          ou
        </p>
        <Label htmlFor="file-upload">
          <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
            Sélectionner des fichiers
          </Button>
        </Label>
        <Input
          id="file-upload"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
        <p className="text-xs text-muted-foreground mt-4">
          JPG, PNG, WebP (Max 5MB par image)
        </p>
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="ou coller l'URL d'une image"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={handleAddUrl} disabled={!urlInput.trim()}>
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Image list */}
      {images.length > 0 && (
        <div className="space-y-2">
          <Label>Images ({images.length})</Label>
          <div className="grid gap-2">
            {images.map((image, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 border rounded-lg bg-card"
              >
                <button
                  type="button"
                  className="cursor-move"
                  onMouseDown={(e) => {
                    // Simple drag reorder implementation
                    const startY = e.clientY;
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaY = e.clientY - startY;
                      if (Math.abs(deltaY) > 50) {
                        const direction = deltaY > 0 ? 1 : -1;
                        const newIndex = index + direction;
                        if (newIndex >= 0 && newIndex < images.length) {
                          moveImage(index, newIndex);
                        }
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      }
                    };
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>

                <img
                  src={image.url}
                  alt={image.alt}
                  className="w-16 h-16 object-cover rounded"
                />

                <div className="flex-1 min-w-0">
                  <Input
                    value={image.alt}
                    onChange={(e) => {
                      const newImages = [...images];
                      newImages[index].alt = e.target.value;
                      onChange(newImages);
                    }}
                    placeholder="Texte alternatif"
                    className="h-8 text-sm"
                  />
                </div>

                <Button
                  type="button"
                  variant={image.is_primary ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPrimary(index)}
                  title="Image principale"
                >
                  <Star className={`h-4 w-4 ${image.is_primary ? 'fill-current' : ''}`} />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
