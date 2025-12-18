-- Add new columns to products table for advanced management
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS sku text UNIQUE,
ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS threshold integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS short_description text,
ADD COLUMN IF NOT EXISTS price_ht numeric,
ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 18,
ADD COLUMN IF NOT EXISTS tags text[];

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock);

-- Add comment for images jsonb structure
COMMENT ON COLUMN public.products.images IS 'Array of image objects: [{"url": "...", "alt": "...", "order": 0, "is_primary": true}]';