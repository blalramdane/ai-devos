import {mkdir,readFile,writeFile} from "node:fs/promises"; import {join} from "node:path";
export interface MemoryEntry{id:string;projectId:string;category:"context"|"decision"|"lesson"|"bug";content:string;createdAt:string;sourceTaskId?:string;tags?:string[];}
export class FileMemoryStore{constructor(private readonly rootDir:string){}
async add(e:MemoryEntry){const d=join(this.rootDir,e.projectId);await mkdir(d,{recursive:true});const xs=await this.read(d);xs.push(e);await writeFile(join(d,"memory.json"),JSON.stringify(xs,null,2),"utf8");}
async list(id:string){return this.read(join(this.rootDir,id));}
async latest(id:string,limit=20){return(await this.list(id)).slice(-limit).reverse();}
async search(id:string,q:string,limit=8){const terms=q.toLowerCase().split(/\s+/).filter(Boolean);return(await this.list(id)).map(e=>({e,s:terms.reduce((n,t)=>n+((e.content+" "+e.category+" "+(e.tags??[]).join(" ")).toLowerCase().includes(t)?1:0),0)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>x.e);}
private async read(d:string){try{return JSON.parse(await readFile(join(d,"memory.json"),"utf8")) as MemoryEntry[]}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}}}