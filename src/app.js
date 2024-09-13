import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { html } from "hono/html";
import { db } from "./db.js";
import { product } from "./schema.js";
import { generateHTML } from "./template.js";
import esMain from "es-main";

export function start_server() {

  const PORT = process.env.PORT || 3000;
  const app = new Hono();

  function searchPagination(totalPages, currentPage, query) {
    const links = [];
    totalPages = Math.max(1, totalPages || 1); // Default to at least 1 page
    currentPage = Math.min(Math.max(1, currentPage || 1), totalPages); // Ensure currentPage is within bounds

    try {
      for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
          links.push(html`<span class="active">${i}</span>`); // Highlight the current page
        } else {
          links.push(html`
            <a href="/?query=${encodeURIComponent(query)}&page=${i}">${i}</a>
          `);
        }
      }
    } catch (error) {
      console.error("Error generating pagination links:", error);
      return [];
    }

    return links;
  }

  app.get("/public/*", serveStatic({ root: "./" }));

  app.get("/", async (c) => {
    const query = c.req.query("query") || ""; // Get search query or default to empty string
    const page = parseInt(c.req.query("page")) || 1;
    const limit = 10;

    try {
      const productsQuery = db
        .select()
        .from(product)
        .where(
          query
            ? ilike(product.name, `%${query}%`) // Use ilike for case-insensitive search
            : undefined
        )
        .limit(limit)
        .offset((page - 1) * limit);

      const products = await productsQuery.all(); // Fetch paginated products

      const totalProductsQuery = db
        .select()
        .from(product)
        .where(
          query
            ? ilike(product.name, `%${query}%`) // Correct ilike syntax with wildcard pattern
            : undefined
        );

      const totalProducts = await totalProductsQuery.all(); // Fetch total number of products for pagination

      const totalPages = Math.ceil(totalProducts.length / limit);
      const paginationLinks = searchPagination(totalPages, page, query);

      return c.html(
        generateHTML({
          title: "Store",
          products: products,
          paginationLinks: paginationLinks,
          status: "",
          query: query
        })
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      return c.html(
        generateHTML({
          title: "Store",
          products: [],
          paginationLinks: [],
          status: "Error fetching products",
          query: query
        })
      );
    }
  });

  // Delete a product route
  app.post("/delete", async (c) => {
    const body = await c.req.parseBody();
    const productId = body.productID; // Ensure this matches the form field name

    if (!productId) {
      return c.json({ success: false, message: "Product ID is required" }, 400);
    }

    try {
      // Delete product by id
      await db.deleteFrom(product).where(eq(product.id, productId));
      return c.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      return c.json({ success: false, message: "Failed to delete product" }, 500);
    }
  });

  // Add a new product route
  app.post("/add", async (c) => {
    const body = await c.req.parseBody();
    const { name, image_url } = body;

    if (!name) {
      return c.json({ success: false, message: "Product name is required" }, 400);
    }

    try {
      // Insert a new product into the database
      await db.insert(product).values({
        name,
        image_url: image_url || 'default_image_url_placeholder.png', // Handle missing image URL
      });
      return c.json({ success: true, message: "Product added successfully" });
    } catch (error) {
      console.error("Error adding product:", error);
      return c.json({ success: false, message: "Failed to add product" }, 500);
    }
  });

  serve({ fetch: app.fetch, port: PORT });
  console.log(`Server is running at http://localhost:${PORT}`);
  return app;
};

if (esMain(import.meta)) {
  start_server();
}
