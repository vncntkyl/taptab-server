import express from "express";
import cors from "cors";
import "./loadEnvironment.mjs";
import records from "./routes/records.mjs";
import users from "./routes/users.mjs";
import storage from "./routes/storage.mjs";
import staticAds from "./routes/staticAds.mjs";
import surveys from "./routes/surveys.mjs";
import planners from "./routes/planner.mjs";
import players from "./routes/players.mjs";
import widgets from "./routes/widgets.mjs";

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());

app.use("/record", records);
app.use("/users", users);
app.use("/storage", storage);
app.use("/staticAds", staticAds);
app.use("/surveys", surveys);
app.use("/planner", planners);
app.use("/players", players);
app.use("/widgets", widgets);

// start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
