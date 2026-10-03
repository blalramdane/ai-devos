import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export interface ProjectContext { projectId:string; identity?:string; goal?:string; stack?:string[]; sourceOfTruth?:string[]; terminology?:Record<string,string>; decisions?:string[]; constraints?:string[]; openIssues?:string[]; milestone?:string; verificationRequirements?:string[]; approvedIntegrations?:string[]; updatedAt:string; }
export class ProjectContextStore {
 constructor(private readonly rootDir:string){}
 private file(id:string){return join(this.rootDir,id,"context.json");}
 async get(id:string):Promise<ProjectContext>{try{return JSON.parse(await readFile(this.file(id),"utf8")) as ProjectContext;}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return {projectId:id,updatedAt:new Date().toISOString()};throw e;}}
 async update(id:string,patch:Partial<Omit<ProjectContext,"projectId"|"updatedAt">>){const next={...(await this.get(id)),...patch,projectId:id,updatedAt:new Date().toISOString()};await mkdir(join(this.rootDir,id),{recursive:true});await writeFile(this.file(id),JSON.stringify(next,null,2),"utf8");return next;}
}