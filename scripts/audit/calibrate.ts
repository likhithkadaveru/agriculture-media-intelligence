import { titleSimilarity } from "@/intelligence/dedup";
const pairs: [string, string, string][] = [
  ["SHOULD-DUP (seed syndication)", "Farmers in north Telangana districts report DAP shortage ahead of sowing", "DAP shortage worries Telangana farmers as sowing window nears"],
  ["SHOULD-DUP (same event)", "Assembly Session To Commence on September 7 | Modi Conspiracy On My US Tour : CM Revanth | V6 News", "Assembly Session To Commence on September 7 | CM Revanth | V6 News"],
  ["SHOULD-DUP (reupload)", "LIVE: Hon'ble CM Sri A. Revanth Reddy Addresses the Media at Telangana Secretariat | CM Press Meet", "LIVE: Hon'ble CM Sri A. Revanth Reddy Addresses the Media at Telangana Secretariat | CM Press Meet"],
  ["SHOULD-NOT (live FP 1)", "LIVE : Telangana Graduate MLC Elections | TBJP | Janasena |తెలంగాణలో నెక్ టు నెక్ ఫ్లైట్ ఖాయమా.?", "LIVE: Non Stop 90 News | AP Political News | Telangana Political News | 25-08-2026 | 10TV News"],
  ["SHOULD-NOT (live FP 2)", "LIVE : CM Revanth Reddy Press Meet | V6 News", "Assembly Session To Commence on September 7 | CM Revanth | V6 News"],
  ["SHOULD-NOT (live FP 3)", "Telangana Assembly Session From September 7 | తెలంగాణ అసెంబ్లీ సమావేశాలకు డేట్ ఫిక్స్.. | 10TV", "LIVE: Non Stop 90 News | AP Political News | Telangana Political News | 25-08-2026 | 10TV News"],
  ["SHOULD-NOT (live FP 4)", "CM Revanth-America Tour Cancel Issue| Harish Rao-22A Land Issue| Vote Removal In Telangana| TOP News", "Assembly Session To Commence on September 7 | CM Revanth | V6 News"],
  ["SHOULD-NOT (live FP 5)", "Minister Nimmala Ramanaidu Big Shock To Farmers | Irrigation Water | Sakshi Tv", "BRS Big Plan From September 2.. 1000 Questions Targeting Congress Government | Sakshi TV"],
  ["SHOULD-NOT (indep farmers)", "DAP shortage in Karimnagar society", "DAP not available in Warangal for three days"],
];
for (const [label, a, b] of pairs) {
  console.log(titleSimilarity(a, b).toFixed(3).padStart(6), label);
}
