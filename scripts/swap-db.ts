import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

function main() {
    const targetProvider = process.argv[2];

    if (!targetProvider || (targetProvider !== "postgresql" && targetProvider !== "sqlite")) {
        console.error("Usage: npx tsx scripts/swap-db.ts <postgresql|sqlite>");
        process.exit(1);
    }

    console.log(`Swapping Prisma provider to: ${targetProvider}`);

    let content = fs.readFileSync(SCHEMA_PATH, "utf-8");

    if (targetProvider === "postgresql") {
        // Swap sqlite -> postgresql
        content = content.replace(
            /datasource db \{\s+provider = "sqlite"\s+url\s+= env\("DATABASE_URL"\)\s+\}/,
            `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
        );
    } else {
        // Swap postgresql -> sqlite
        content = content.replace(
            /datasource db \{\s+provider\s+= "postgresql"\s+url\s+= env\("DATABASE_URL"\)\s+directUrl = env\("DIRECT_URL"\)\s+\}/,
            `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`
        );
    }

    fs.writeFileSync(SCHEMA_PATH, content);
    console.log("✅ Managed schema.prisma successfully updated.");
}

main();
