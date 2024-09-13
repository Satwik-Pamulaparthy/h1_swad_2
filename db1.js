import { db } from "./db.js";
import { product } from "./schema.js";

console.log(db.select().from(product).limit().all());

db.insert(product).values({
    name: "Test Example Product",
    image_url: imageUrl,
}).run();

db.delete(product).where(eq(product.id, productID)).run();

console.log("Added product:", name)