"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Product {
  itemId: string;
  name: string;
  rate: number;
  description: string;
  sku: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type PageState =
  | "loading"
  | "ready"
  | "expired"
  | "not_found"
  | "submitted"
  | "error";

/* ─── Component ─────────────────────────────────────────────────────── */
export default function QuoteBuilderPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [customerName, setCustomerName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    estimateNumber: string;
    total: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Validate token ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/quote-builder/${token}`);
        if (res.status === 404) return setPageState("not_found");
        if (res.status === 410) return setPageState("expired");
        if (!res.ok) return setPageState("error");
        const data = await res.json();
        setCustomerName(data.customerName);
        setPageState("ready");
      } catch {
        setPageState("error");
      }
    })();
  }, [token]);

  /* ── Fetch products ─────────────────────────────────────────────── */
  useEffect(() => {
    if (pageState !== "ready") return;
    (async () => {
      try {
        const res = await fetch(`/api/quote-builder/${token}/products`);
        if (!res.ok) return;
        const data = await res.json();
        setProducts(data.products);
        setFilteredProducts(data.products);
      } catch {
        /* silent */
      }
    })();
  }, [pageState, token]);

  /* ── Client-side search filter ──────────────────────────────────── */
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFilteredProducts(products);
      return;
    }
    setFilteredProducts(
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
    );
  }, [search, products]);

  /* ── Cart helpers ────────────────────────────────────────────────── */
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.itemId);
      next.set(product.itemId, {
        product,
        quantity: existing ? existing.quantity + 1 : 1,
      });
      return next;
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, { ...existing, quantity: newQty });
      }
      return next;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.product.rate * item.quantity,
    0
  );

  /* ── Submit ─────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (cartItems.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/quote-builder/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((ci) => ({
            itemId: ci.product.itemId,
            quantity: ci.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setSubmitResult({
        estimateNumber: data.estimateNumber,
        total: data.total,
      });
      setPageState("submitted");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  /* ── Non-ready states ───────────────────────────────────────────── */
  if (pageState === "loading") {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.spinner} />
        <p style={{ color: "#9CA3AF", marginTop: 16 }}>Loading...</p>
      </div>
    );
  }

  if (pageState === "not_found") {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.iconCircle}>🔗</div>
        <h1 style={styles.stateTitle}>Link Not Found</h1>
        <p style={styles.stateDesc}>
          This quote link is invalid or does not exist.
        </p>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.iconCircle}>⏰</div>
        <h1 style={styles.stateTitle}>Link Expired</h1>
        <p style={styles.stateDesc}>
          This quote link has expired. Please contact us for a new one.
        </p>
      </div>
    );
  }

  if (pageState === "submitted") {
    return (
      <div style={styles.centerScreen}>
        <div style={{ ...styles.iconCircle, background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }}>✅</div>
        <h1 style={styles.stateTitle}>Quote Submitted!</h1>
        <p style={styles.stateDesc}>
          {submitResult
            ? `Estimate #${submitResult.estimateNumber} — Total: $${submitResult.total.toFixed(2)}`
            : "Your quote request has been submitted."}
        </p>
        <p style={{ ...styles.stateDesc, marginTop: 8 }}>
          Our team will review and get back to you shortly.
        </p>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div style={styles.centerScreen}>
        <div style={{ ...styles.iconCircle, background: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)" }}>⚠️</div>
        <h1 style={styles.stateTitle}>Something Went Wrong</h1>
        <p style={styles.stateDesc}>
          We couldn&apos;t load this quote page. Please try refreshing.
        </p>
      </div>
    );
  }

  /* ── Main quote builder UI ──────────────────────────────────────── */
  return (
    <div style={styles.pageWrapper}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <h1 style={styles.headerTitle}>
              <span style={styles.logoAccent}>⚡</span> AutoGate Electric
            </h1>
            <p style={styles.headerSubtitle}>Quote Builder</p>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.customerBadge}>
              {customerName}
            </span>
          </div>
        </div>
      </header>

      <div style={styles.mainContent}>
        {/* Search + Products */}
        <div style={styles.productsColumn}>
          <div style={styles.searchBar}>
            <svg
              style={styles.searchIcon}
              viewBox="0 0 20 20"
              fill="currentColor"
              width="18"
              height="18"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            {search && (
              <button
                style={styles.clearBtn}
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>

          <p style={styles.resultCount}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
          </p>

          <div style={styles.productGrid}>
            {filteredProducts.map((product) => {
              const inCart = cart.get(product.itemId);
              return (
                <div key={product.itemId} style={styles.productCard}>
                  <div style={styles.productInfo}>
                    <h3 style={styles.productName}>{product.name}</h3>
                    {product.sku && (
                      <span style={styles.skuBadge}>SKU: {product.sku}</span>
                    )}
                    {product.description && (
                      <p style={styles.productDesc}>{product.description}</p>
                    )}
                  </div>
                  <div style={styles.productFooter}>
                    <span style={styles.price}>
                      ${product.rate.toFixed(2)}
                    </span>
                    {inCart ? (
                      <div style={styles.qtyControls}>
                        <button
                          style={styles.qtyBtn}
                          onClick={() => updateQuantity(product.itemId, -1)}
                        >
                          −
                        </button>
                        <span style={styles.qtyValue}>{inCart.quantity}</span>
                        <button
                          style={styles.qtyBtn}
                          onClick={() => updateQuantity(product.itemId, 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        style={styles.addBtn}
                        onClick={() => addToCart(product)}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div style={styles.emptyState}>
                <p style={{ color: "#9CA3AF" }}>
                  No products match &ldquo;{search}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <aside style={styles.cartSidebar}>
          <div style={styles.cartHeader}>
            <h2 style={styles.cartTitle}>Your Selection</h2>
            <span style={styles.cartCount}>
              {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {cartItems.length === 0 ? (
            <div style={styles.cartEmpty}>
              <p style={{ color: "#6B7280", textAlign: "center" as const }}>
                Select products to build your quote.
              </p>
            </div>
          ) : (
            <>
              <div style={styles.cartItems}>
                {cartItems.map((ci) => (
                  <div key={ci.product.itemId} style={styles.cartItem}>
                    <div style={styles.cartItemInfo}>
                      <span style={styles.cartItemName}>
                        {ci.product.name}
                      </span>
                      <span style={styles.cartItemPrice}>
                        ${(ci.product.rate * ci.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div style={styles.cartItemActions}>
                      <div style={styles.qtyControls}>
                        <button
                          style={styles.qtyBtnSmall}
                          onClick={() =>
                            updateQuantity(ci.product.itemId, -1)
                          }
                        >
                          −
                        </button>
                        <span style={styles.qtyValueSmall}>
                          {ci.quantity}
                        </span>
                        <button
                          style={styles.qtyBtnSmall}
                          onClick={() =>
                            updateQuantity(ci.product.itemId, 1)
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        style={styles.removeBtn}
                        onClick={() => removeFromCart(ci.product.itemId)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.cartFooter}>
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Estimated Total</span>
                  <span style={styles.totalValue}>
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>

                {errorMsg && (
                  <p style={styles.errorMsg}>{errorMsg}</p>
                )}

                <button
                  style={{
                    ...styles.submitBtn,
                    opacity: submitting ? 0.6 : 1,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Quote Request"}
                </button>

                <p style={styles.disclaimer}>
                  This is a quote request. Final pricing may vary after team
                  review.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  /* Layout */
  pageWrapper: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    textAlign: "center",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(255,255,255,0.1)",
    borderTopColor: "#6366F1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    marginBottom: 20,
  },
  stateTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 28,
    fontWeight: 600,
    color: "#F3F4F6",
    marginBottom: 8,
  },
  stateDesc: {
    color: "#9CA3AF",
    fontSize: 16,
    maxWidth: 400,
    lineHeight: 1.5,
  },

  /* Header */
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(17, 24, 39, 0.8)",
    backdropFilter: "blur(12px)",
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
  },
  headerInner: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: "#F3F4F6",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoAccent: { fontSize: 24 },
  headerSubtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  customerBadge: {
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    color: "#A5B4FC",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 500,
  },

  /* Main */
  mainContent: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 24px",
    display: "flex",
    gap: 24,
    flex: 1,
  },
  productsColumn: {
    flex: 1,
    minWidth: 0,
  },

  /* Search */
  searchBar: {
    position: "relative" as const,
    marginBottom: 16,
  },
  searchIcon: {
    position: "absolute" as const,
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#6B7280",
  },
  searchInput: {
    width: "100%",
    padding: "12px 40px 12px 42px",
    background: "rgba(17, 24, 39, 0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    color: "#F3F4F6",
    fontSize: 15,
    outline: "none",
  },
  clearBtn: {
    position: "absolute" as const,
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#6B7280",
    cursor: "pointer",
    fontSize: 14,
  },
  resultCount: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
  },

  /* Product Grid */
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  productCard: {
    background: "rgba(17, 24, 39, 0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "border-color 0.2s, transform 0.2s",
    cursor: "default",
  },
  productInfo: { marginBottom: 14 },
  productName: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 16,
    fontWeight: 600,
    color: "#F3F4F6",
    marginBottom: 4,
  },
  skuBadge: {
    display: "inline-block",
    background: "rgba(255,255,255,0.06)",
    color: "#9CA3AF",
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 6,
    marginBottom: 6,
  },
  productDesc: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 1.4,
    marginTop: 6,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  productFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  price: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: "#A5B4FC",
  },
  addBtn: {
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    color: "#A5B4FC",
    padding: "8px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    transition: "background 0.2s",
  },
  qtyControls: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(99, 102, 241, 0.1)",
    borderRadius: 10,
    padding: "4px 6px",
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "rgba(99, 102, 241, 0.2)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    color: "#A5B4FC",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    color: "#F3F4F6",
    fontSize: 15,
    fontWeight: 600,
    minWidth: 24,
    textAlign: "center" as const,
  },

  /* Cart Sidebar */
  cartSidebar: {
    width: 360,
    flexShrink: 0,
    background: "rgba(17, 24, 39, 0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    position: "sticky" as const,
    top: 80,
    maxHeight: "calc(100vh - 104px)",
    overflow: "hidden",
  },
  cartHeader: {
    padding: "20px 20px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: "#F3F4F6",
  },
  cartCount: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  cartEmpty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  cartItems: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px 20px",
  },
  cartItem: {
    padding: "12px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  cartItemInfo: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cartItemName: {
    color: "#F3F4F6",
    fontSize: 14,
    fontWeight: 500,
    flex: 1,
    marginRight: 8,
  },
  cartItemPrice: {
    color: "#A5B4FC",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  },
  cartItemActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "#A5B4FC",
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValueSmall: {
    color: "#F3F4F6",
    fontSize: 13,
    fontWeight: 600,
    minWidth: 20,
    textAlign: "center" as const,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#6B7280",
    cursor: "pointer",
    fontSize: 13,
    padding: "4px 8px",
  },

  /* Cart Footer */
  cartFooter: {
    padding: 20,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  totalLabel: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: 500,
  },
  totalValue: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: "#F3F4F6",
  },
  submitBtn: {
    width: "100%",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s, transform 0.1s",
    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
  },
  errorMsg: {
    color: "#EF4444",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center" as const,
  },
  disclaimer: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center" as const,
    marginTop: 12,
    lineHeight: 1.4,
  },
  emptyState: {
    gridColumn: "1 / -1",
    textAlign: "center" as const,
    padding: 40,
  },
};
