#!/usr/bin/env node
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { diffLines } from "diff";
import chalk from "chalk";
import {Command} from "commander";

const program = new Command();
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
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );
    index.push({ path: filePath, hash: fileHash });
    await fs.writeFile(this.indexPath, JSON.stringify(index));
  }

  async commit(message) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );
    const parentCommit = await this.getCurrentHead();

    const commitData = {
      timeStamp: new Date().toISOString(),
      message,
      files: index,
      parent: parentCommit,
    };

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

  async log() {
    let currentCommitHash = await this.getCurrentHead();
    while (currentCommitHash) {
      const commitData = JSON.parse(
        await fs.readFile(path.join(this.objectsPath, currentCommitHash), {
          encoding: "utf-8",
        })
      );
      console.log("-------------------");
      console.log(
        `Commit: ${currentCommitHash}\n Date:${commitData.timeStamp}\n \n ${commitData.message}\n\n`
      );
      currentCommitHash = commitData.parent;
    }
  }

  async getCommitData(commitHash) {
    const commitPath = path.join(this.objectsPath, commitHash);
    try {
      return await fs.readFile(commitPath, { encoding: "utf-8" });
    } catch (error) {
      console.log("Failed to fetch the commit data");
      return;
    }
  }

  async getParentCommitData(parentCommitHash) {
    const parentCommitPath = path.join(this.objectsPath, parentCommitHash);
    try {
      return await fs.readFile(parentCommitPath, { encoding: "utf-8" });
    } catch (error) {
      console.log("Failed to fetch the  parent commit data");
      return;
    }
  }

  async getFileContent(fileHash) {
    const filepath = path.join(this.objectsPath, fileHash);
    try {
      return await fs.readFile(filepath, { encoding: "utf-8" });
    } catch (error) {
      console.log("File does not exist");
    }
  }

  async getParentFileContent(parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(
      (file) => file.path === filePath
    );

    if (parentFile) {
      //get the file content from parent commit and return
      return await this.getFileContent(parentFile.hash);
    }
  }

  async showCommitDiff(commitHash) {
    const commitData = JSON.parse(await this.getCommitData(commitHash));
    if (!commitData) {
      console.log("Commit Not found");
      return;
    }
    console.log("Changes in the last commit are : ");

    if (commitData.parent) {

      const parentCommitHash = commitData.parent;
      const parentCommitData = JSON.parse(await this.getCommitData(parentCommitHash));

      //try every file of current commit and compare with the parent commit
      for (const file of commitData.files) {
        console.log(`File:${file.path}`);
        const fileContent = await this.getFileContent(file.hash);

        const parentFileContent = await this.getParentFileContent(parentCommitData,file.path);

        if(parentFileContent !== undefined){
          console.log(`\nDiff:`)

          const diff = diffLines(parentFileContent,fileContent);

          diff.forEach(part => {
            if(part.added){
              process.stdout.write( chalk.green("++"+ part.value))
            }else if(part.removed){
              process.stdout.write(chalk.red("--" + part.value))
            }else{
              process.stdout.write(chalk.grey(part.value))
            }
          })

          console.log();//new line

        }else{
          console.log("New file in this commit")
        }

      }


    }
    else {
      console.log("first commit - so no parent to compare and get the diff");
    }

  }
}

const groot = new Groot();

// (async () => {
//   // await groot.add("sample2.txt");
//   // await groot.commit("6th commit");
//   // await groot.log();
//   await groot.showCommitDiff('559129c74cb79589654b9a3e6d175818740f7aa1');
// })();

program.command('init').action(async () =>{
  const groot = new Groot();
})

program.command('add <file>').action(async (file)=>{
  const groot = new Groot();
  await groot.add(file);
})


program.command('commit <message>').action(async (message)=>{
  const groot = new Groot();
  await groot.commit(message);
})



program.command('log').action(async ()=>{
  const groot = new Groot();
  await groot.log();
})




program.command('show <commitHash>').action(async (commitHash)=>{
  const groot = new Groot();
  await groot.showCommitDiff(commitHash);
})


program.parse(process.argv);


