import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

let writeQueue = Promise.resolve();

export async function readDb(): Promise<any> {
  return new Promise((resolve) => {
    writeQueue = writeQueue.then(() => {
      try {
        if (fs.existsSync(DB_FILE_PATH)) {
          const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
          return resolve(JSON.parse(raw));
        }
      } catch (e) {
        console.error("Error reading local SQL database file:", e);
      }
      resolve({});
    });
  });
}

export async function writeDb(db: any): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
        resolve();
      } catch (err) {
        console.error("Error saving local SQL database file:", err);
        reject(err);
      }
    });
  });
}
