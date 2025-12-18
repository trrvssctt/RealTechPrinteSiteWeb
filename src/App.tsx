import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { Analytics } from "@/components/Analytics";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Home from "./pages/Home";
import Category from "./pages/Category";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import CustomFlocage from "./pages/CustomFlocage";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Orders from "./pages/admin/Orders";
import Testimonials from "./pages/admin/Testimonials";
import ContactInfo from "./pages/admin/ContactInfo";
import AbandonedCarts from "./pages/admin/AbandonedCarts";
import AdminLogin from "./pages/admin/AdminLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <CartProvider>
          <Analytics />
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public routes with Header/Footer */}
            <Route path="/" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Home />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/serigraphie" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Category />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/flocage" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Category />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/imprimantes" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Category />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/produit/:id" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <ProductDetail />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/panier" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Cart />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/contact" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Contact />
                </main>
                <Footer />
              </div>
            } />
            <Route path="/flocage-personnalise" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <CustomFlocage />
                </main>
                <Footer />
              </div>
            } />

            {/* Auth route (no header/footer) */}
            <Route path="/ne_ka_connection_page" element={<Auth />} />

            {/* Admin login (public) */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="orders" element={<Orders />} />
              <Route path="carts" element={<AbandonedCarts />} />
              <Route path="testimonials" element={<Testimonials />} />
              <Route path="contact" element={<ContactInfo />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;