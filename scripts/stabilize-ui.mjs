import fs from "node:fs";
const path="app/page.tsx";
let s=fs.readFileSync(path,"utf8");
const variants=[
  '["Région","Civilisation","Village","Personnage","Influence"]',
  '["Région", "Civilisation", "Village", "Personnage", "Influence"]'
];
for(const v of variants){
  s=s.replace(v,v.replace('"Personnage","Influence"','"Personnage","Créature","Influence"').replace('"Personnage", "Influence"','"Personnage", "Créature", "Influence"'));
}
fs.writeFileSync(path,s);
console.log("Arthenis UI stabilization patch applied.");
