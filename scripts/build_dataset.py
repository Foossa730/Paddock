import json, csv, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

# (marque, modele, annee, pays, categorie, energie, architecture, cylindree_cc, ch, nm,
#  boite, rapports, transmission, 0-100 s, vmax km/h, poids kg, prix €, places, en_production)
RAW = [
 ("Porsche","911 GT3 (992)",2022,"Allemagne","Sportive","Essence","Flat-6 atmosphérique",3996,510,470,"PDK",7,"Propulsion",3.4,318,1435,197000,2,True),
 ("Porsche","911 Turbo S (992)",2021,"Allemagne","Sportive","Essence","Flat-6 biturbo",3745,650,800,"PDK",8,"Intégrale",2.7,330,1640,240000,4,True),
 ("Porsche","718 Cayman GT4 RS",2022,"Allemagne","Sportive","Essence","Flat-6 atmosphérique",3996,500,450,"PDK",7,"Propulsion",3.4,315,1415,155000,2,True),
 ("Porsche","Taycan Turbo S",2020,"Allemagne","Berline sportive","Électrique","2 moteurs électriques",None,761,1050,"Automatique",2,"Intégrale",2.8,260,2295,190000,4,True),
 ("Ferrari","296 GTB",2022,"Italie","Supercar","Hybride","V6 biturbo + électrique",2992,830,740,"Double embrayage",8,"Propulsion",2.9,330,1470,270000,2,True),
 ("Ferrari","SF90 Stradale",2020,"Italie","Hypercar","Hybride","V8 biturbo + 3 moteurs électriques",3990,1000,800,"Double embrayage",8,"Intégrale",2.5,340,1570,450000,2,True),
 ("Ferrari","812 Competizione",2021,"Italie","Supercar","Essence","V12 atmosphérique",6496,830,692,"Double embrayage",7,"Propulsion",2.85,340,1487,500000,2,False),
 ("Ferrari","12Cilindri",2024,"Italie","GT","Essence","V12 atmosphérique",6496,830,678,"Double embrayage",8,"Propulsion",2.9,340,1560,400000,2,True),
 ("Lamborghini","Huracán STO",2021,"Italie","Supercar","Essence","V10 atmosphérique",5204,640,565,"Double embrayage",7,"Propulsion",3.0,310,1339,330000,2,False),
 ("Lamborghini","Revuelto",2023,"Italie","Hypercar","Hybride","V12 atmosphérique + 3 moteurs électriques",6498,1015,725,"Double embrayage",8,"Intégrale",2.5,350,1772,500000,2,True),
 ("Lamborghini","Temerario",2024,"Italie","Supercar","Hybride","V8 biturbo + 3 moteurs électriques",3995,920,800,"Double embrayage",8,"Intégrale",2.7,343,1690,300000,2,True),
 ("McLaren","750S",2023,"Royaume-Uni","Supercar","Essence","V8 biturbo",3994,750,800,"Séquentielle SSG",7,"Propulsion",2.8,332,1389,330000,2,True),
 ("McLaren","Artura",2022,"Royaume-Uni","Supercar","Hybride","V6 biturbo + électrique",2993,680,720,"Double embrayage",8,"Propulsion",3.0,330,1498,240000,2,True),
 ("Aston Martin","Vantage",2024,"Royaume-Uni","Sportive","Essence","V8 biturbo",3982,665,800,"Automatique",8,"Propulsion",3.5,325,1605,190000,2,True),
 ("Aston Martin","DB12",2023,"Royaume-Uni","GT","Essence","V8 biturbo",3982,680,800,"Automatique",8,"Propulsion",3.6,325,1685,230000,4,True),
 ("Lotus","Emira V6",2022,"Royaume-Uni","Sportive","Essence","V6 compresseur",3456,405,420,"Manuelle",6,"Propulsion",4.3,290,1405,98000,2,True),
 ("Bugatti","Chiron Super Sport",2021,"France","Hypercar","Essence","W16 quadriturbo",7993,1600,1600,"Double embrayage",7,"Intégrale",2.4,440,1995,3500000,2,False),
 ("Alpine","A110 S",2023,"France","Sportive","Essence","4 cylindres turbo",1798,300,340,"Double embrayage",7,"Propulsion",4.2,260,1109,76000,2,True),
 ("Koenigsegg","Jesko Absolut",2022,"Suède","Hypercar","Essence","V8 biturbo",5065,1600,1500,"Multi-embrayages LST",9,"Propulsion",2.5,480,1390,3000000,2,True),
 ("Pagani","Huayra",2012,"Italie","Hypercar","Essence","V12 biturbo",5980,730,1000,"Séquentielle",7,"Propulsion",3.3,370,1350,2500000,2,False),
 ("Rimac","Nevera",2022,"Croatie","Hypercar","Électrique","4 moteurs électriques",None,1914,2360,"Rapport unique",1,"Intégrale",1.85,412,2300,2400000,2,True),
 ("Maserati","MC20",2021,"Italie","Supercar","Essence","V6 biturbo",2992,630,730,"Double embrayage",8,"Propulsion",2.9,325,1475,230000,2,True),
 ("Mercedes-AMG","GT 63 4MATIC+",2023,"Allemagne","GT","Essence","V8 biturbo",3982,585,800,"Automatique MCT",9,"Intégrale",3.2,315,1970,190000,4,True),
 ("BMW","M4 CSL",2022,"Allemagne","Sportive","Essence","6 cylindres en ligne biturbo",2993,550,650,"Automatique",8,"Propulsion",3.7,307,1625,160000,2,False),
 ("Audi","R8 V10 Performance",2019,"Allemagne","Supercar","Essence","V10 atmosphérique",5204,620,580,"Double embrayage",7,"Intégrale",3.1,331,1595,210000,2,False),
 ("Nissan","GT-R Nismo",2024,"Japon","Supercar","Essence","V6 biturbo",3799,600,652,"Double embrayage",6,"Intégrale",2.8,315,1720,220000,4,True),
 ("Toyota","GR Supra 3.0",2023,"Japon","Sportive","Essence","6 cylindres en ligne turbo",2998,340,500,"Automatique",8,"Propulsion",4.3,250,1570,72000,2,True),
 ("Honda","Civic Type R (FL5)",2023,"Japon","Compacte sportive","Essence","4 cylindres turbo",1996,329,420,"Manuelle",6,"Traction",5.4,275,1429,55000,5,True),
 ("Mazda","MX-5 2.0",2024,"Japon","Roadster","Essence","4 cylindres atmosphérique",1998,184,205,"Manuelle",6,"Propulsion",6.5,219,1065,38000,2,True),
 ("Chevrolet","Corvette Z06 (C8)",2023,"États-Unis","Supercar","Essence","V8 atmosphérique",5463,680,623,"Double embrayage",8,"Propulsion",2.9,312,1561,140000,2,True),
 ("Ford","Mustang Shelby GT500",2020,"États-Unis","Muscle car","Essence","V8 compresseur",5163,770,847,"Double embrayage",7,"Propulsion",3.5,290,1916,95000,4,False),
 ("Tesla","Model S Plaid",2023,"États-Unis","Berline sportive","Électrique","3 moteurs électriques",None,1020,1420,"Rapport unique",1,"Intégrale",2.1,322,2190,110000,5,True),
 ("Hyundai","Ioniq 5 N",2024,"Corée du Sud","Compacte sportive","Électrique","2 moteurs électriques",None,650,770,"Rapport unique",1,"Intégrale",3.5,260,2200,75000,5,True),
]

docs = []
for r in RAW:
    (marque, modele, annee, pays, cat, energie, archi, cc, ch, nm, boite, rapports, trans,
     zc, vmax, poids, prix, places, prod) = r
    docs.append({
        "marque": marque,
        "modele": modele,
        "annee": annee,
        "pays": pays,
        "categorie": cat,
        "moteur": {"energie": energie, "architecture": archi, "cylindree_cc": cc,
                   "puissance_ch": ch, "couple_nm": nm},
        "transmission": {"boite": boite, "rapports": rapports, "type": trans},
        "performances": {"zero_a_cent_s": zc, "vitesse_max_kmh": vmax},
        "poids_kg": poids,
        "rapport_poids_puissance_kg_ch": round(poids / ch, 2),
        "prix_eur": prix,
        "places": places,
        "en_production": prod,
    })

with open(os.path.join(OUT, "voitures.json"), "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2)

flat_cols = ["marque","modele","annee","pays","categorie","energie","architecture","cylindree_cc",
             "puissance_ch","couple_nm","boite","rapports","transmission","zero_a_cent_s",
             "vitesse_max_kmh","poids_kg","rapport_poids_puissance_kg_ch","prix_eur","places","en_production"]
with open(os.path.join(OUT, "voitures.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f); w.writerow(flat_cols)
    for d in docs:
        w.writerow([d["marque"], d["modele"], d["annee"], d["pays"], d["categorie"],
                    d["moteur"]["energie"], d["moteur"]["architecture"], d["moteur"]["cylindree_cc"],
                    d["moteur"]["puissance_ch"], d["moteur"]["couple_nm"], d["transmission"]["boite"],
                    d["transmission"]["rapports"], d["transmission"]["type"],
                    d["performances"]["zero_a_cent_s"], d["performances"]["vitesse_max_kmh"],
                    d["poids_kg"], d["rapport_poids_puissance_kg_ch"], d["prix_eur"], d["places"], d["en_production"]])

print(len(docs), "voitures")
