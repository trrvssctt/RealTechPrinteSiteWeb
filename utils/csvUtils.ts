export const exportProductsToCSV = (products: any[]) => {
  const headers = [
    "SKU",
    "Nom",
    "Catégorie",
    "Description courte",
    "Description",
    "Prix HT",
    "TVA (%)",
    "Prix TTC",
    "Stock",
    "Seuil",
    "En stock",
    "Vedette",
    "URL Image principale"
  ];

  const rows = products.map(product => [
    product.sku || "",
    product.name || "",
    product.categories?.name || "",
    product.short_description || "",
    product.description || "",
    product.price_ht || "",
    product.tva_rate || "18",
    product.price || "",
    product.stock || "0",
    product.threshold || "5",
    product.in_stock ? "OUI" : "NON",
    product.featured ? "OUI" : "NON",
    product.image_url || ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `produits_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSVFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("Le fichier CSV est vide ou invalide"));
          return;
        }

        const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
        const products = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map(v => v.replace(/"/g, "").trim());
          
          if (values.length >= headers.length) {
            const product: any = {};
            headers.forEach((header, index) => {
              product[header] = values[index];
            });

            // Map CSV headers to database fields
            products.push({
              sku: product.SKU || "",
              name: product.Nom || "",
              short_description: product["Description courte"] || "",
              description: product.Description || "",
              price_ht: parseFloat(product["Prix HT"]) || null,
              tva_rate: parseFloat(product["TVA (%)"]) || 18,
              price: parseFloat(product["Prix TTC"]) || 0,
              stock: parseInt(product.Stock) || 0,
              threshold: parseInt(product.Seuil) || 5,
              in_stock: product["En stock"]?.toUpperCase() === "OUI",
              featured: product.Vedette?.toUpperCase() === "OUI",
              image_url: product["URL Image principale"] || null,
              slug: (product.Nom || "").toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
            });
          }
        }

        resolve(products);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier"));
    reader.readAsText(file, "UTF-8");
  });
};
