import { MongoClient } from "mongodb";

const connectionString =
  "mongodb+srv://kylerinoza:tqh0vgJbTUs1TBma@cluster-0.2fhszl4.mongodb.net/?retryWrites=true&w=majority&ssl=true";
const client = new MongoClient(connectionString);

let conn;
try {
  conn = await client.connect();
} catch (e) {
  console.error(e);
}

let db = conn.db("TaptabDB");

export default db;
