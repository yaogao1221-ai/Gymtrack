// Saisie des repas en langage courant : « un verre de lait, 2 œufs et une assiette de pâtes »
// devient une liste d'aliments de la table Ciqual avec leur poids estimé. Tout est calculé dans l'appli,
// sans service extérieur : un dictionnaire des aliments courants (avec leurs portions habituelles)
// puis, à défaut, une recherche par mots dans la table Ciqual.

export const fnorm = (t) => (t || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’'`´]/g, ' ').replace(/[-_]/g, ' ');

// Valeurs pour 100 g d'aliments absents de Ciqual (étiquettes et recettes moyennes)
const C = {
  lben: { n: 'Lben (lait fermenté)', k: 40, p: 3.2, g: 4.6, l: 1 },
  kesra: { n: 'Kesra, galette de semoule', k: 300, p: 8, g: 52, l: 6.5 },
  msemen: { n: 'Msemen / mhadjeb', k: 330, p: 7, g: 45, l: 14 },
  tacos: { n: 'Tacos (sandwich, frites, sauce)', k: 230, p: 11, g: 22, l: 11 },
  chakchouka: { n: 'Chakchouka', k: 105, p: 5, g: 6, l: 7 },
  loubia: { n: 'Loubia (haricots blancs en sauce)', k: 120, p: 6, g: 15, l: 4 },
  makrout: { n: 'Makrout', k: 420, p: 4, g: 62, l: 17 },
  zlabia: { n: 'Zlabia', k: 400, p: 2, g: 70, l: 14 },
  kalb: { n: 'Qalb el louz / basboussa', k: 380, p: 4, g: 60, l: 14 },
  barreprot: { n: 'Barre protéinée', k: 350, p: 30, g: 35, l: 11 },
  whey: { n: 'Protéine en poudre (whey)', k: 380, p: 78, g: 7, l: 5 },
  gainer: { n: 'Gainer', k: 390, p: 20, g: 70, l: 4 },
  creatine: { n: 'Créatine', k: 0, p: 0, g: 0, l: 0 },
  thementhe: { n: 'Thé à la menthe sucré', k: 40, p: 0, g: 10, l: 0 },
  fruitssecs: { n: 'Mélange de fruits secs', k: 600, p: 18, g: 15, l: 52 },
};

// [mots-clés séparés par |, code Ciqual ou aliment perso, portions]
// portion = quantité quand rien n'est précisé, piece = poids d'une unité (« 2 œufs »), units = contenants propres à l'aliment
const A = [
  ['lait|lait demi ecreme|lait de vache|lait vache', '19041', { portion: 250 }],
  ['lait entier', '19023', { portion: 250 }], ['lait ecreme', '19050', { portion: 250 }],
  ['lben|leben|lait fermente|lait caille|raib|rayeb|l ben', C.lben, { portion: 250 }],
  ['lait de soja|boisson soja|boisson au soja', '18113', { portion: 250 }],
  ['lait d amande|boisson amande|lait vegetal|boisson vegetale|lait d avoine', '18112', { portion: 250 }],
  ['kefir', '19865', { portion: 250 }],
  ['oeuf|oeuf dur|oeuf a la coque|oeuf poche', '22010', { piece: 50, portion: 50 }],
  ['oeuf au plat|oeuf sur le plat', '22505', { piece: 50, portion: 50 }],
  ['oeuf brouille', '22502', { piece: 55, portion: 110 }], ['omelette', '22500', { piece: 150, portion: 150 }],
  ['blanc d oeuf', '22008', { piece: 33, portion: 100 }],
  ['riz|riz blanc|riz cuit', '9104', { portion: 200, units: { assiette: 250, bol: 200 } }],
  ['riz basmati', '9125', { portion: 200, units: { assiette: 250, bol: 200 } }],
  ['riz complet', '9103', { portion: 200, units: { assiette: 250, bol: 200 } }],
  ['riz cru|riz sec', '9100', { portion: 70 }],
  ['pates|spaghetti|macaroni|penne|tagliatelle|coquillette|fusilli|pates cuites|nouilles', '9811', { portion: 220, units: { assiette: 250, bol: 200 } }],
  ['pates crues|pates seches', '9810', { portion: 80 }], ['pates completes', '9871', { portion: 220, units: { assiette: 250 } }],
  ['pates bolognaise|spaghetti bolognaise|pates a la bolognaise|bolognaise', '25085', { portion: 300, units: { assiette: 300 } }],
  ['pates carbonara|carbonara', '25135', { portion: 300, units: { assiette: 300 } }],
  ['couscous|couscous a la viande|couscous viande', '25152', { portion: 350, units: { assiette: 350 } }],
  ['couscous au poulet|couscous poulet', '25138', { portion: 350, units: { assiette: 350 } }],
  ['couscous au mouton|couscous mouton|couscous agneau', '25029', { portion: 350, units: { assiette: 350 } }],
  ['couscous royal', '25127', { portion: 350, units: { assiette: 350 } }],
  ['semoule|graine de couscous', '9683', { portion: 200, units: { assiette: 250 } }],
  ['quinoa', '9341', { portion: 150 }], ['frik', '51511', { portion: 200 }],
  ['pain|pain blanc|pain de boulanger', '7001', { portion: 60, piece: 250, units: { tranche: 30, morceau: 40 } }],
  ['baguette|baguette de pain', '7001', { piece: 250, portion: 250, units: { morceau: 60 } }],
  ['pain complet', '7110', { portion: 60, units: { tranche: 30 } }],
  ['pain de mie|pain toast', '7200', { piece: 25, portion: 50, units: { tranche: 25 } }],
  ['pain pita|pita', '7180', { piece: 60, portion: 60 }], ['pain burger|bun', '7259', { piece: 60, portion: 60 }],
  ['tortilla|galette de ble|galette wrap', '7815', { piece: 60, portion: 60 }],
  ['kesra|galette|matlou|matlouh|khobz eddar|pain maison|pain arabe', C.kesra, { piece: 150, portion: 100, units: { morceau: 60, part: 80, tranche: 50 } }],
  ['msemen|msemmen|mhadjeb|mahjouba|mhajeb|m semen|mhajeb', C.msemen, { piece: 110, portion: 110 }],
  ['croissant', '7619', { piece: 60, portion: 60 }], ['pain au chocolat|chocolatine', '7730', { piece: 70, portion: 70 }],
  ['brioche', '7746', { piece: 60, portion: 60, units: { tranche: 35 } }], ['pain au lait', '7710', { piece: 35, portion: 35 }],
  ['cereales|cereale|corn flakes|cornflakes', '32003', { portion: 40, units: { bol: 40, assiette: 40 } }],
  ['flocons d avoine|avoine', '32140', { portion: 50, units: { bol: 60 } }], ['porridge', '9313', { portion: 250, units: { bol: 250 } }],
  ['muesli|granola', '32004', { portion: 50, units: { bol: 50 } }],
  ['poulet|blanc de poulet|filet de poulet|escalope de poulet|poitrine de poulet|blanc de volaille', '36018', { portion: 150, piece: 130 }],
  ['cuisse de poulet|pilon|pilon de poulet|haut de cuisse', '36006', { piece: 120, portion: 120 }],
  ['poulet roti|poulet au four', '36005', { portion: 200, units: { part: 200 } }],
  ['aile de poulet|ailes de poulet|wings', '36033', { piece: 40, portion: 160 }],
  ['nuggets', '36027', { piece: 20, portion: 120 }], ['cordon bleu', '25089', { piece: 100, portion: 100 }],
  ['dinde|escalope de dinde|blanc de dinde cuit', '36306', { portion: 150, piece: 130 }],
  ['escalope panee|escalope milanaise', '36036', { piece: 130, portion: 130 }],
  ['steak|steak hache|viande hachee|hache|kefta|kofta', '6259', { piece: 100, portion: 125 }],
  ['bifteck|entrecote|faux filet|rumsteck|bavette|steak de boeuf', '6207', { piece: 180, portion: 180 }],
  ['viande|viande rouge|boeuf|viande de boeuf', '6585', { portion: 150 }],
  ['agneau|mouton|viande d agneau', '21523', { portion: 150 }], ['cotelette|cote d agneau|cotelettes d agneau', '21524', { piece: 80, portion: 160 }],
  ['merguez', '30155', { piece: 50, portion: 100 }], ['saucisse', '30780', { piece: 50, portion: 100 }],
  ['jambon', '28910', { piece: 40, portion: 40, units: { tranche: 40 } }],
  ['jambon de dinde|blanc de dinde|jambon de poulet|blanc de poulet en tranche|cachir|pate de dinde', '28964', { piece: 30, portion: 40, units: { tranche: 30 } }],
  ['thon|thon au naturel', '26039', { portion: 100, units: { boite: 110 } }], ['thon a l huile', '26180', { portion: 100, units: { boite: 110 } }],
  ['sardine', '26040', { piece: 25, portion: 90, units: { boite: 90 } }],
  ['saumon|pave de saumon', '26229', { portion: 150, piece: 130 }], ['saumon fume', '26037', { portion: 50, units: { tranche: 25 } }],
  ['poisson|poisson blanc|cabillaud|colin|merlu|lieu|dorade|merlan|filet de poisson', '26249', { portion: 150, piece: 130 }],
  ['crevette', '10100', { piece: 10, portion: 100 }], ['surimi', '26046', { piece: 15, portion: 60 }], ['poisson pane', '26030', { piece: 60, portion: 120 }],
  ['yaourt|yogourt|yoghourt|yaourt aux fruits', '19624', { piece: 125, portion: 125 }],
  ['yaourt nature', '19593', { piece: 125, portion: 125 }], ['yaourt 0|yaourt 0%|yaourt allege|yaourt 0 %', '19594', { piece: 125, portion: 125 }],
  ['yaourt grec|yaourt a la grecque', '19860', { piece: 150, portion: 150 }],
  ['skyr|yaourt proteine|yaourt hyperproteine|hipro|yaourt protein|danone hipro', '19724', { piece: 160, portion: 160 }],
  ['fromage blanc', '19646', { portion: 100, piece: 100 }], ['fromage blanc 0|fromage blanc 0%', '19644', { portion: 100, piece: 100 }],
  ['petit suisse', '19721', { piece: 60, portion: 60 }], ['creme dessert|danette', '39211', { piece: 125, portion: 125 }],
  ['fromage', '12999', { portion: 30, units: { tranche: 20, morceau: 30, part: 30 } }],
  ['vache qui rit|fromage fondu|portion de fromage|kiri|carre de fromage', '12303', { piece: 17, portion: 17 }],
  ['emmental|gruyere|comte', '12115', { portion: 30, units: { tranche: 20 } }], ['camembert', '12001', { portion: 30 }],
  ['mozzarella', '19590', { piece: 125, portion: 60 }], ['cheddar', '12726', { portion: 20, units: { tranche: 20 } }],
  ['parmesan', '12120', { portion: 10 }], ['feta', '12066', { portion: 30 }], ['chevre|fromage de chevre', '12833', { portion: 30 }],
  ['fromage rape|gruyere rape|emmental rape', '12775', { portion: 20 }],
  ['beurre', '16400', { portion: 10, units: { morceau: 10, noix: 10 } }],
  ['creme|creme fraiche', '19410', { portion: 30 }], ['creme legere|creme fraiche legere', '19431', { portion: 30 }],
  ['huile|huile d olive', '17270', { portion: 10, units: { 'cuillere a soupe': 10, 'cuillere a cafe': 4 } }],
  ['huile de tournesol|huile de table', '17440', { portion: 10, units: { 'cuillere a soupe': 10, 'cuillere a cafe': 4 } }],
  ['mayonnaise|mayo', '11054', { portion: 15 }], ['ketchup', '11008', { portion: 15 }], ['vinaigrette', '11110', { portion: 15 }],
  ['sauce blanche|sauce samourai|sauce algerienne|sauce kebab|sauce burger', '11203', { portion: 30 }],
  ['miel', '31008', { portion: 20 }], ['confiture', '31024', { portion: 20 }],
  ['nutella|pate a tartiner', '31032', { portion: 20 }], ['beurre de cacahuete|peanut butter|beurre d arachide', '15202', { portion: 20 }],
  ['sucre|sucre en poudre', '31016', { portion: 5, units: { morceau: 5 } }],
  ['chocolat|chocolat au lait', '31004', { portion: 20, units: { carre: 5, barre: 40, tablette: 100 } }],
  ['chocolat noir', '31074', { portion: 20, units: { carre: 5, tablette: 100 } }],
  ['chocolat chaud|cacao|nesquik|lait chocolate|chocolat au lait chaud', '18104', { portion: 250 }],
  ['banane', '13005', { piece: 120, portion: 120 }], ['pomme', '13039', { piece: 150, portion: 150 }],
  ['orange', '13034', { piece: 150, portion: 150 }], ['clementine|mandarine', '13024', { piece: 60, portion: 60 }],
  ['kiwi', '13021', { piece: 75, portion: 75 }], ['poire', '13037', { piece: 160, portion: 160 }],
  ['peche|nectarine|brugnon', '13043', { piece: 150, portion: 150 }], ['abricot', '13000', { piece: 40, portion: 40 }],
  ['fraise', '13014', { piece: 15, portion: 150 }], ['raisin', '13395', { portion: 125, units: { grappe: 150 } }],
  ['raisin sec', '13046', { portion: 30 }], ['mangue', '13025', { piece: 300, portion: 150 }],
  ['ananas', '13002', { portion: 150, units: { tranche: 80 } }], ['pasteque|dellaa', '13036', { portion: 300, units: { tranche: 300 } }],
  ['melon', '13026', { portion: 200, units: { tranche: 150 } }], ['cerise', '13008', { piece: 7, portion: 150 }],
  ['myrtille', '13028', { portion: 100 }], ['figue', '13012', { piece: 50, portion: 50 }], ['figue seche', '13013', { piece: 20, portion: 40 }],
  ['datte|deglet nour|tmar', '13011', { piece: 8, portion: 24 }], ['avocat', '13004', { piece: 140, portion: 140 }],
  ['compote|compote de pomme', '13212', { piece: 100, portion: 100 }], ['grenade', '13018', { piece: 150, portion: 150 }],
  ['figue de barbarie|hendi', '13063', { piece: 60, portion: 60 }],
  ['salade|salade verte|laitue', '25604', { portion: 100, units: { assiette: 100, bol: 100 } }],
  ['tomate', '20385', { piece: 120, portion: 120 }], ['tomate cerise', '20172', { piece: 12, portion: 100 }],
  ['concombre', '20019', { piece: 300, portion: 100 }], ['carotte', '20009', { piece: 100, portion: 100 }],
  ['carotte cuite|carottes cuites', '20353', { piece: 100, portion: 150 }], ['brocoli', '20351', { portion: 150 }],
  ['haricot vert|haricots verts', '20030', { portion: 150 }], ['courgette', '20021', { piece: 200, portion: 150 }],
  ['poivron', '20087', { piece: 150, portion: 100 }], ['oignon', '20034', { piece: 100, portion: 50 }],
  ['epinard', '20027', { portion: 150 }], ['champignon', '20125', { portion: 100 }], ['petits pois|petit pois', '20037', { portion: 150 }],
  ['legumes|legume|legumes cuits|legumes du couscous', '20497', { portion: 200, units: { assiette: 250 } }],
  ['pois chiche|pois chiches|hommos', '20507', { portion: 150 }], ['lentille|lentilles|aadas', '20360', { portion: 200, units: { assiette: 300 } }],
  ['haricot rouge|haricots rouges', '20503', { portion: 150 }],
  ['loubia|haricots blancs en sauce|haricot blanc', C.loubia, { portion: 300, units: { assiette: 300 } }],
  ['pomme de terre|patate|pommes de terre', '4048', { piece: 150, portion: 200 }],
  ['puree|puree de pomme de terre', '4040', { portion: 200, units: { assiette: 250 } }],
  ['frites|frite', '4032', { portion: 150, units: { cornet: 120, barquette: 150 } }], ['patate douce', '4102', { piece: 200, portion: 200 }],
  ['olive', '13184', { piece: 4, portion: 30 }],
  ['pizza', '25516', { piece: 450, portion: 300, units: { part: 125, tranche: 125 } }],
  ['kebab|sandwich kebab|grec|sandwich grec|chawarma|shawarma', '25429', { piece: 350, portion: 350 }],
  ['tacos|tacos francais', C.tacos, { piece: 450, portion: 450 }],
  ['burger|hamburger', '25413', { piece: 110, portion: 110 }], ['cheeseburger', '25414', { piece: 120, portion: 120 }],
  ['big mac|double cheese|double cheeseburger', '25415', { piece: 210, portion: 210 }],
  ['sandwich', '25522', { piece: 250, portion: 250 }], ['wrap', '25647', { piece: 200, portion: 200 }],
  ['panini', '25434', { piece: 220, portion: 220 }], ['croque monsieur', '25547', { piece: 130, portion: 130 }],
  ['quiche', '25405', { portion: 150, units: { part: 150 } }], ['lasagne|lasagnes', '25081', { portion: 300, units: { part: 300, assiette: 300 } }],
  ['hachis parmentier', '25009', { portion: 300 }], ['chili|chili con carne', '25111', { portion: 300 }],
  ['sushi|maki|california', '25456', { piece: 30, portion: 200 }],
  ['tajine|tajine de poulet|marka', '25204', { portion: 350, units: { assiette: 350 } }], ['tajine de viande|tajine d agneau|tajine de mouton', '25159', { portion: 350, units: { assiette: 350 } }],
  ['chorba|chorba frik|harira|jari', '25915', { portion: 300, units: { bol: 300, assiette: 350 } }],
  ['soupe|soupe de legumes|potage|veloute', '25969', { portion: 300, units: { bol: 300, assiette: 350 } }],
  ['bourek|brick|boureks', '25557', { piece: 70, portion: 140 }], ['taboule', '25608', { portion: 150 }], ['houmous', '25621', { portion: 50 }],
  ['riz cantonais', '25088', { portion: 250 }], ['nouilles chinoises|nouilles sautees|nouilles instantanees|ramen', '25243', { portion: 300 }],
  ['salade cesar', '25628', { portion: 300 }], ['chakchouka|shakshuka|chekchouka', C.chakchouka, { portion: 300, units: { assiette: 300 } }],
  ['chips', '4004', { portion: 30, units: { paquet: 45, sachet: 45 } }],
  ['biscuit|biscuits|gateau sec|gateaux secs', '24000', { piece: 10, portion: 30 }], ['petit beurre', '24015', { piece: 8, portion: 32 }],
  ['gateau|cake', '23000', { portion: 80, units: { part: 80, tranche: 60, morceau: 60 } }],
  ['cookie', '24684', { piece: 25, portion: 25 }], ['madeleine', '24632', { piece: 25, portion: 25 }],
  ['crepe', '23799', { piece: 60, portion: 60 }], ['crepe au nutella|crepe au chocolat', '23821', { piece: 90, portion: 90 }],
  ['gaufre', '23851', { piece: 60, portion: 60 }], ['glace|creme glacee|sorbet', '39527', { portion: 100, units: { boule: 50, pot: 100, cornet: 70 } }],
  ['beignet|donut|sfenj', '23880', { piece: 60, portion: 60 }], ['baklava|baklawa', '23300', { piece: 40, portion: 40 }],
  ['makrout|makroud', C.makrout, { piece: 50, portion: 50 }], ['zlabia|zalabia', C.zlabia, { piece: 40, portion: 80 }],
  ['qalb el louz|kalb el louz|basboussa|basbousa|chamia', C.kalb, { piece: 80, portion: 80 }],
  ['barre chocolatee|mars|snickers|twix|kinder bueno|bounty|kitkat|kit kat', '31000', { piece: 50, portion: 50 }],
  ['barre cerealiere|barre de cereales', '31101', { piece: 25, portion: 25 }],
  ['barre proteinee|barre de proteine|barre proteine|barre protein|protein bar', C.barreprot, { piece: 60, portion: 60 }],
  ['bonbon|bonbons|haribo', '31060', { piece: 5, portion: 30 }],
  ['amande', '15000', { piece: 1.2, portion: 30 }], ['noix', '15005', { piece: 5, portion: 30 }], ['noix de cajou|cajou', '15054', { piece: 1.5, portion: 30 }],
  ['noisette', '15004', { piece: 1, portion: 30 }], ['cacahuete|cacahouete|arachide', '15002', { piece: 1, portion: 30 }],
  ['pistache', '15044', { piece: 0.7, portion: 30 }], ['fruits secs|melange de fruits secs|oleagineux', C.fruitssecs, { portion: 30 }],
  ['galette de riz|galettes de riz', '7352', { piece: 9, portion: 18 }], ['tofu', '20904', { portion: 125 }],
  ['whey|proteine|proteine en poudre|shaker|shake|shake proteine|isolate|proteines', C.whey, { piece: 30, portion: 30, units: { scoop: 30, dose: 30, mesure: 30, shaker: 30 } }],
  ['gainer|mass gainer', C.gainer, { portion: 100, units: { scoop: 50, dose: 50, mesure: 50 } }], ['creatine', C.creatine, { portion: 5 }],
  ['eau|eau minerale|eau plate|eau gazeuse', '18066', { portion: 250 }],
  ['cafe|cafe noir|cafe allonge|cafe filtre', '18004', { piece: 100, portion: 100, units: { tasse: 100 } }],
  ['expresso|espresso|cafe expresso', '18071', { piece: 40, portion: 40, units: { tasse: 40 } }],
  ['cafe au lait|cafe creme|cappuccino|latte|nous nous|cafe latte', '18151', { piece: 200, portion: 200 }],
  ['the|the vert|the noir|infusion|tisane', '18020', { portion: 200 }], ['the a la menthe|the menthe|atay', C.thementhe, { portion: 150, units: { verre: 100 } }],
  ['coca|coca cola|cola|soda|pepsi|hamoud|selecto|fanta|sprite|orangina|boisson gazeuse', '18018', { portion: 330, units: { canette: 330, bouteille: 500 } }],
  ['coca zero|coca light|pepsi max|soda zero|cola zero', '18060', { portion: 330, units: { canette: 330, bouteille: 500 } }],
  ['jus|jus d orange|jus de fruit|jus de fruits', '2070', { portion: 200, units: { bouteille: 330 } }], ['jus de pomme', '2074', { portion: 200 }],
  ['jus de raisin', '2016', { portion: 200 }], ['smoothie', '2500', { portion: 250 }],
  ['red bull|monster|boisson energisante|redbull', '18352', { portion: 250, units: { canette: 250 } }],
  ['ice tea|the glace|lipton|fuze tea', '18075', { portion: 330, units: { canette: 330, bouteille: 500 } }],
  ['limonade', '18010', { portion: 250 }], ['biere', '5001', { portion: 250, units: { pinte: 500, canette: 330, bouteille: 330 } }],
  ['vin', '5210', { portion: 125, units: { verre: 125 } }],
];

// Contenants et mesures courants (grammes ou ml, 1 ml ≈ 1 g)
const UNITS = {
  verre: 200, tasse: 200, mug: 300, bol: 300, assiette: 300, plat: 400, louche: 250, 'cuillere a soupe': 15, 'cuillere a cafe': 5, pincee: 1,
  tranche: 30, morceau: 30, carre: 6, poignee: 30, part: 150, portion: 150, pot: 125, canette: 330, bouteille: 500, boite: 140, sachet: 30,
  paquet: 45, scoop: 30, dose: 30, mesure: 30, barre: 40, tablette: 100, boule: 50, cornet: 120, barquette: 150, grappe: 150, noix: 10, pinte: 500, shaker: 30,
};
const UNIT_WORDS = [
  ['cuillere a soupe', /^(?:cuilleres?|cuill?|c) (?:a )?(?:s|soupe)\b|^(?:cas|cs|cuillerees? a soupe)\b/],
  ['cuillere a cafe', /^(?:cuilleres?|cuill?|c) (?:a )?(?:c|cafe)\b|^(?:cac|cc|cuillerees? a cafe)\b/],
  ['cuillere a soupe', /^cuilleres?\b|^cuillerees?\b/],
  ...Object.keys(UNITS).filter((u) => !u.startsWith('cuillere')).map((u) => [u, new RegExp(`^${u}(?:s|x)?\\b`)]),
];
const MASS = [[/^(?:kg|kilos?|kilogrammes?)\b/, 1000], [/^(?:g|gr|grs|grammes?)\b/, 1], [/^(?:ml|millilitres?)\b/, 1], [/^(?:cl|centilitres?)\b/, 10], [/^(?:dl)\b/, 100], [/^(?:l|litres?)\b/, 1000]];
const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100, demi: 0.5, demie: 0.5, moitie: 0.5, quart: 0.25, quelques: 3, plusieurs: 3 };
const SIZE = { petit: 0.7, petite: 0.7, petits: 0.7, petites: 0.7, grand: 1.3, grande: 1.3, grands: 1.3, grandes: 1.3, gros: 1.3, grosse: 1.3, grosses: 1.3, bon: 1.15, bonne: 1.15, bonnes: 1.15, bons: 1.15, enorme: 1.6, mini: 0.5 };
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'au', 'aux', 'a', 'en', 'un', 'une', 'et', 'avec', 'mon', 'ma', 'mes', 'son', 'sa', 'peu', 'aussi', 'encore', 'bien', 'tres']);

const stem = (w) => (w.length > 3 ? w.replace(/(?:s|x)$/, '') : w);
const words = (t) => t.split(/\s+/).filter(Boolean);
const keyRe = (k) => new RegExp(`(?:^|\\s)${words(k).map((w) => `${stem(w).replace(/[.*+?^${}()|[\]\\%]/g, '\\$&')}(?:s|x|es)?`).join('\\s+')}(?=\\s|$)`);
const ALIASES = A.map(([keys, src, o]) => ({ keys: keys.split('|').map((k) => ({ k, re: keyRe(k), len: k.length })), src, ...o }));

// Repère le repas dans la phrase : « ce matin », « à midi », « au goûter », « ce soir »…
const MEAL_RE = [
  ['petit_dej', /\b(?:petit dej\w*|ce matin|au reveil|le matin|shour|s hour|souhour)\b/],
  ['dejeuner', /\b(?:dejeuner|ce midi|a midi|le midi|midi)\b/],
  ['collation', /\b(?:gouter|collation|en cas|encas|snack|apres la seance|avant la seance|apres le sport|avant le sport)\b/],
  ['diner', /\b(?:diner|ce soir|le soir|souper|ftour|iftar|f tour)\b/],
];
export function detectMeal(text) { const t = fnorm(text); for (const [k, re] of MEAL_RE) if (re.test(t)) return k; return null; }

const FILLERS = /\b(?:j ai|je viens de|on a|il y avait|y avait|c etait|ensuite|apres ca|aussi|encore|un peu|environ|a peu pres|genre|voila|et puis|j avais|apres (?:la seance|le sport|l entrainement|la salle|le training)|avant (?:la seance|le sport|l entrainement|la salle|le training))\b|\b(?:mange|manger|bu|boire|bois|pris|prendre|avale|grignote|bouffe)\b|\b(?:ce|au|a la|a|le|la|pour le|pour la|en|du)?\s*(?:petit dej\w*|dejeuner|diner|gouter|collation|souper|ftour|iftar|f tour|shour|souhour|matin|midi|soir|reveil|en cas|encas|snack)\b/g;

// Découpe une phrase en morceaux d'aliments
export function splitMeal(text) {
  let t = fnorm(text).replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)\s*\/\s*(\d)/g, '$1/$2').replace(/(\d)([a-z])/g, '$1 $2');
  t = t.replace(/\bet (demie?|quart)\b/g, 'et_$1').replace(FILLERS, ' ');
  return t.split(/\s*(?:[,;!?\n+]|\.(?!\d)|\bet\b|\bavec\b|\bpuis\b|\bplus\b|\bainsi que\b|\baccompagne d\w*\b)\s*/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && !/^(?:de|du|des|un|une|la|le|les)$/.test(s));
}

const num = (w) => {
  if (/^\d+(?:\.\d+)?$/.test(w)) return Number(w);
  const f = w.match(/^(\d+)\/(\d+)$/); if (f) return Number(f[1]) / Number(f[2]);
  return NUMW[w] ?? null;
};

// Lit la quantité au début (ou à la fin) d'un morceau : « 2 grands verres de », « une demi baguette », « riz 150 g »
export function parseQty(chunk, noUnit = false) {
  let s = ` ${chunk} `.replace(/\s+/g, ' ').trim(); let qty = null; let unit = null; let mass = null; let size = 1;
  const eat = (re) => { const m = s.match(re); if (!m) return null; s = s.slice(m[0].length).trim(); return m; };
  const readNum = () => {
    const w = s.split(' ')[0]; let n = num(w); if (n == null) return null;
    s = s.slice(w.length).trim();
    if ((w === 'un' || w === 'une') && /^(?:demie?|quart)\b/.test(s)) { n = s.startsWith('quart') ? 0.25 : 0.5; s = s.replace(/^\w+/, '').trim(); }
    if (n >= 2 && n < 10 && /^cents?\b/.test(s)) { n *= 100; s = s.replace(/^\w+/, '').trim(); }
    if (/^quarts?\b/.test(s) && n < 4) { n *= 0.25; s = s.replace(/^\w+/, '').trim(); }
    if (/^et_(?:demie?)\b/.test(s)) { n += 0.5; s = s.replace(/^\S+/, '').trim(); }
    if (/^et_quart\b/.test(s)) { n += 0.25; s = s.replace(/^\S+/, '').trim(); }
    return n;
  };
  qty = readNum();
  const sz = s.split(' ')[0]; if (SIZE[sz]) { size = SIZE[sz]; s = s.slice(sz.length).trim(); }
  if (qty != null) for (const [re, f] of MASS) if (eat(re)) { mass = qty * f; break; }
  if (mass == null && !noUnit) for (const [u, re] of UNIT_WORDS) if (eat(re)) { unit = u; break; }
  if (/^demie?\b/.test(s) && (unit || qty == null)) { qty = (qty ?? 1) * 0.5; s = s.replace(/^\w+/, '').trim(); }
  if (/^et_(?:demie?)\b/.test(s) && qty != null) { qty += 0.5; s = s.replace(/^\S+/, '').trim(); }
  const sz2 = s.split(' ')[0]; if (SIZE[sz2] && !unit && qty == null) { size = SIZE[sz2]; s = s.slice(sz2.length).trim(); }
  eat(/^(?:(?:de la|de l|du|des|de|d|en)\b\s*)+/);
  // Quantité donnée après l'aliment : « riz 150 g », « lait 30 cl »
  if (mass == null && qty == null) {
    const m = s.match(/\s(\d+(?:\.\d+)?)\s*(kg|kilos?|g|gr|grammes?|ml|cl|dl|l|litres?)$/);
    if (m) { const f = MASS.find(([re]) => re.test(m[2]))[1]; mass = Number(m[1]) * f; s = s.slice(0, m.index).trim(); }
  }
  s = s.replace(/^(?:et_\w+)\s*/, '').replace(/\bet_\w+\b/g, '').trim();
  return { qty, unit, mass, size, rest: s };
}

// ---- Recherche dans la table Ciqual ----
let index = null;
const ciq = (f) => ({ name: f.n, code: f.c, per100: { k: f.k, p: f.p ?? 0, g: f.g ?? 0, l: f.l ?? 0 }, por: f.por });
function getIndex(foods) {
  if (index?.foods === foods) return index;
  const byCode = new Map(); const rows = [];
  for (const f of foods) { byCode.set(f.c, f); const n = fnorm(f.n); rows.push({ f, n, w: words(n.replace(/[^a-z0-9 ]/g, ' ')) }); }
  index = { foods, byCode, rows }; return index;
}
export function searchCiqual(text, foods, limit = 6) {
  const q = words(fnorm(text).replace(/[^a-z0-9% ]/g, ' ')).filter((w) => !STOP.has(w) && !/^\d/.test(w)).map(stem);
  if (!q.length) return [];
  const { rows } = getIndex(foods);
  const out = [];
  for (const r of rows) {
    let hit = 0; let first = false;
    q.forEach((w, i) => { if (r.w.some((x) => x.startsWith(w) && (w.length >= 3 || x === w))) { hit++; if (i === 0) first = true; } });
    if (!first || hit < Math.ceil(q.length / 2)) continue;
    let sc = hit * 10 - r.n.length / 25 - (q.length - hit) * 4;
    if (r.w[0] && r.w[0].startsWith(q[0])) sc += 6;
    if (r.n.includes('aliment moyen')) sc += 3;
    if (/preemballe|appertise|surgele|poudre|deshydrate|enrichi/.test(r.n)) sc -= 1.5;
    if (/\bcru(?:e|s|es)?\b/.test(r.n) && !q.includes('cru')) sc -= 1;
    out.push({ r, sc });
  }
  return out.sort((a, b) => b.sc - a.sc).slice(0, limit).map((x) => ciq(x.r.f));
}

function findAlias(text) {
  const t = ` ${text} `; let best = null;
  for (const a of ALIASES) for (const k of a.keys) if (k.re.test(t) && (!best || k.len > best.len)) best = { a, len: k.len };
  return best?.a || null;
}
const aliasFood = (a, foods) => {
  if (typeof a.src === 'object') return { name: a.src.n, code: null, per100: { k: a.src.k, p: a.src.p, g: a.src.g, l: a.src.l } };
  const f = getIndex(foods).byCode.get(a.src); return f ? ciq(f) : null;
};

export const r1 = (x) => Math.round(x * 10) / 10;
export const nutr = (per100, g) => ({ kcal: Math.round(per100.k * g / 100), p: r1(per100.p * g / 100), g: r1(per100.g * g / 100), l: r1(per100.l * g / 100) });

const fmtQ = (q) => (q === 0.5 ? '½' : q === 0.25 ? '¼' : q === 1.5 ? '1 ½' : String(r1(q)).replace('.', ','));
const UNIT_LABEL = { 'cuillere a soupe': 'c. à soupe', 'cuillere a cafe': 'c. à café', carre: 'carré', poignee: 'poignée', boite: 'boîte', pincee: 'pincée' };
function qtyLabel({ qty, unit, mass, size }, grams) {
  const sz = size < 1 ? 'petit ' : size > 1.2 ? 'grand ' : '';
  if (mass != null) return `${Math.round(mass)} g`;
  if (unit) return `${fmtQ(qty ?? 1)} ${sz}${UNIT_LABEL[unit] || unit}${(qty ?? 1) > 1 && !unit.includes(' ') ? 's' : ''} · ${Math.round(grams)} g`;
  if (qty != null) return `${fmtQ(qty)} ${sz}${qty > 1 ? "pièces" : "pièce"} · ${Math.round(grams)} g`;
  return `${sz ? `${sz}portion` : 'portion'} · ${Math.round(grams)} g`;
}

// Poids estimé d'un aliment selon la quantité dite
export function gramsFor(q, alias, food) {
  if (q.mass != null) return q.mass;
  const n = q.qty ?? 1;
  if (q.unit) return n * (alias?.units?.[q.unit] ?? UNITS[q.unit]) * q.size;
  if (q.qty != null) return n * (alias?.piece ?? food?.por ?? alias?.portion ?? 100) * q.size;
  return (alias?.portion ?? food?.por ?? 100) * q.size;
}

// Analyse complète : texte libre → aliments reconnus (avec d'autres choix possibles) et morceaux non compris
export function parseMeal(text, foods) {
  const items = []; const unknown = [];
  for (const chunk of splitMeal(text)) {
    let q = parseQty(chunk); let rest = q.rest || chunk;
    let alias = findAlias(rest);
    // « une barre protéinée » : le contenant fait partie du nom de l'aliment
    if (q.unit && !alias) { const q2 = parseQty(chunk, true); const a2 = findAlias(q2.rest); if (a2) { q = q2; rest = q2.rest; alias = a2; } }
    if (!rest || /^\d/.test(rest)) { unknown.push(chunk); continue; }
    let food = alias ? aliasFood(alias, foods) : null;
    const alts = searchCiqual(rest, foods, 6).filter((f) => f.code !== food?.code);
    if (!food) food = alts.shift() || null;
    if (!food) { unknown.push(chunk); continue; }
    const grams = Math.max(1, Math.round(gramsFor(q, alias, food)));
    items.push({ raw: chunk, said: rest, food, grams, label: qtyLabel(q, grams), q, alias: alias ? { piece: alias.piece, portion: alias.portion, units: alias.units } : null, alts: alts.slice(0, 5), sure: !!alias });
  }
  return { items, unknown, meal: detectMeal(text) };
}

// Poids recalculé quand on choisit un autre aliment pour la même phrase (la quantité dite reste la même)
export function regram(item, food) {
  const alias = food.code === item.food.code ? item.alias : null;
  const grams = Math.max(1, Math.round(gramsFor(item.q, alias, food)));
  return { ...item, food, grams, label: qtyLabel(item.q, grams), alias };
}

export const ALIAS_CODES = A.map(([, src]) => src).filter((s) => typeof s === 'string');
