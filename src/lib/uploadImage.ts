import apiFetch from "@/lib/api";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload une image vers Cloudinary via le backend.
 * Retourne l'URL sécurisée de l'image hébergée.
 */
export async function uploadImage(file: File, folder: "products" | "categories" | "services" | "misc" = "misc"): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" n'est pas une image`);
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`"${file.name}" dépasse 5MB`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });

  const resp = await apiFetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, folder }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || "Échec de l'upload de l'image");
  }
  return data.data.url as string;
}
