import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
    console.log(`Example running at http://localhost:${PORT}`);
});