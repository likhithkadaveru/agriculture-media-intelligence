import { assessRelevance } from "@/intelligence/relevance";
const text = "CM Revanth Reddy: No Hidden Agenda in US Visit, Condemns Centre's Discrimination The Chief Minister addressed the media at the Secretariat regarding the denial of permission for the US tour, and listed the government's work for farmers, students and workers across the state of Telangana over the past year in various sectors.";
const v = assessRelevance(text, {
  title: "CM Revanth Reddy: No Hidden Agenda in US Visit, Condemns Centre's Discrimination",
  authorContext: "Telangana CMO channel-kind:government",
  sourceKind: "government",
});
console.log(JSON.stringify(v, null, 2));
