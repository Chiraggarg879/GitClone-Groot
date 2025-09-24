import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

class Groot {
  constructor(repoPath = ".") {
    this.repoPath = path.join(repoPath, ".groot"); // .groot folder
    this.objectsPath = path.join(this.repoPath, "objects"); // .groot/objects folder
    this.headPath = path.join(this.repoPath, "HEAD"); // .groot/HEAD
    this.indexPath = path.join(this.repoPath, "index"); // .groot/index
    this.init();
  }

  async init() {
    await fs.mkdir(this.objectsPath, { recursive: true });
    try {
      await fs.writeFile(this.headPath, "", { flag: "wx" }); // opens for writing, fails if file exists
      await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: "wx" });
    } catch (error) {
      console.log("Already initialized the .groot folder");
    }
  }

  hashObject(content) {
    return crypto.createHash("sha1").update(content, "utf-8").digest("hex");
  }

  async add(fileToBeAdded) {
    const fileData = await fs.readFile(fileToBeAdded, { encoding: "utf-8" });

    const fileHash = this.hashObject(fileData);
    console.log(fileHash);

    const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
    await fs.writeFile(newFileHashedObjectPath, fileData);

    await this.updateStagingArea(fileToBeAdded, fileHash);
    console.log(`Added ${fileToBeAdded}`);
  }

  async updateStagingArea(filePath, fileHash) {
    const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: "utf-8" }));
    index.push({ path: filePath, hash: fileHash });
    await fs.writeFile(this.indexPath, JSON.stringify(index));
  }

  async commit(message) {
    // 🔥 FIXED: added await and JSON.parse
    const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: "utf-8" }));

    // 🔥 FIXED: added await + call method correctly
    const parentCommit = await this.getCurrentHead();

    const commitData = {
      timeStamp: new Date().toISOString(), // ✅ FIXED: call toISOString()
      message,
      files: index,
      parent: parentCommit,
    };

    // 🔥 FIXED: stringify before hashing
    const commitHash = this.hashObject(JSON.stringify(commitData));
    const commitPath = path.join(this.objectsPath, commitHash);

    await fs.writeFile(commitPath, JSON.stringify(commitData));
    await fs.writeFile(this.headPath, commitHash);
    await fs.writeFile(this.indexPath, JSON.stringify([]));

    console.log(`Commit done successfully with commit id ${commitHash}`);
  }

  async getCurrentHead() {
    try {
      return await fs.readFile(this.headPath, { encoding: "utf-8" });
    } catch (error) {
      return null;
    }
  }
}

const groot = new Groot();

(async () => {

  await groot.add("sample.txt");
  await groot.commit("initial commit");
})();
