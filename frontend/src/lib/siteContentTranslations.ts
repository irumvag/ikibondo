/**
 * Built-in French and Kinyarwanda text for the public site sections in
 * siteContent.ts (DEFAULTS is English). resolveSection() layers these under
 * anything an admin writes in that language.
 *
 * The Kinyarwanda text is a DRAFT: a native speaker with health-worker
 * experience must review it (docs/i18n.md, docs/glossary.md).
 */
import type { Lang, SiteContent } from './siteContent';

type Translations = { [K in keyof SiteContent]?: Partial<SiteContent[K]> };

export const BUILTIN_TRANSLATIONS: Partial<Record<Exclude<Lang, 'en'>, Translations>> = {
  fr: {
    'home.hero': {
      title: "Repérer le retard de croissance d'un enfant avant qu'il ne devienne une urgence.",
      body: "Ikibondo est l'outil où les agents de santé communautaires, les infirmiers et les superviseurs des camps de réfugiés du Rwanda enregistrent chaque mesure, la comparent aux normes de croissance de l'OMS et voient quels enfants ont besoin d'aide en premier.",
      primary_cta: 'Se connecter',
      secondary_cta: "S'inscrire comme parent",
      note: 'Les comptes des agents de santé sont créés par le superviseur de votre camp.',
    },
    'home.how_it_works': {
      title: "De la visite à domicile à l'orientation",
      subtitle: "Chaque mesure prise par un agent de santé parvient à ceux qui peuvent agir.",
      steps: [
        {
          title: "Un agent de santé mesure l'enfant",
          description: "Les agents de santé communautaires visitent les familles de leur zone et notent le poids, la taille, le périmètre brachial, les œdèmes et les symptômes sur leur téléphone. Les visites sont enregistrées même sans connexion et envoyées dès que le réseau revient.",
        },
        {
          title: 'Ikibondo vérifie les mesures',
          description: "Chaque visite est comparée aux normes de croissance de l'OMS et classée en risque FAIBLE, MOYEN ou ÉLEVÉ. Les raisons de chaque score sont expliquées simplement pour que l'infirmier puisse vérifier.",
        },
        {
          title: 'La bonne personne est prévenue',
          description: "Les infirmiers et les superviseurs sont alertés le jour même pour les enfants à haut risque. Les parents reçoivent un rappel avant chaque vaccin.",
        },
      ],
    },
    'home.roles': {
      title: 'Ce que chacun voit en se connectant',
      roles: [
        {
          role: 'Agents de santé communautaires',
          description: "Enregistrent les visites et les mesures, et retrouvent un enfant en scannant sa carte QR. Fonctionne hors ligne sur le terrain.",
          features: 'Visites hors ligne; Recherche par QR; Résultat du risque après chaque visite',
        },
        {
          role: 'Infirmiers',
          description: "Consultent les dossiers, ajoutent des notes cliniques, organisent les séances de vaccination et voient pourquoi un enfant a reçu son score.",
          features: 'Principales raisons de chaque score; Notes cliniques; Courbes de croissance OMS',
        },
        {
          role: 'Superviseurs',
          description: "Suivent l'activité des agents par zone, répondent aux alertes de haut risque et préparent les rapports pour la direction du camp.",
          features: 'Activité des agents; Alertes de haut risque; Rapports exportables',
        },
        {
          role: 'Parents et tuteurs',
          description: "Voient la croissance et le carnet de vaccination de leur enfant, reçoivent des rappels par SMS et demandent une visite à leur agent de santé.",
          features: 'Croissance expliquée simplement; Carnet de vaccination; Rappels par SMS',
        },
      ],
    },
    'home.muac': {
      title: "Lire un ruban MUAC comme un agent de santé",
      body: "Le ruban fait le tour du milieu du bras de l'enfant. Sa couleur indique à l'agent de santé quoi faire ensuite. Déplacez le curseur pour voir chaque couleur.",
    },
    about: {
      title: 'Les carnets de croissance papier se perdent. Les enfants ne doivent pas se perdre.',
      intro_1: "Dans un camp très fréquenté, le poids d'un enfant peut être noté sur une carte à une visite et sur une autre à la suivante. Quand les dossiers sont dispersés, un enfant qui prend du retard peut passer inaperçu jusqu'à ce qu'il soit gravement malade.",
      intro_2: "Ikibondo tient un seul dossier par enfant, visible par chaque agent de santé, infirmier et superviseur du camp. Chaque nouvelle mesure est comparée aux normes de l'OMS dès son enregistrement : les enfants qui ont besoin d'aide sont visibles le jour même.",
      principles_title: 'Nos principes',
      principles: [
        { title: "L'infirmier décide", body: "Un score de risque invite à regarder de plus près, ce n'est jamais un diagnostic. Chaque score indique les mesures qui l'expliquent, pour qu'un soignant puisse le vérifier et le corriger." },
        { title: 'Fonctionne sans réseau', body: "Les agents de santé continuent d'enregistrer les visites sans connexion. Les dossiers sont envoyés dès le retour du réseau, sans rien perdre." },
        { title: 'Les familles gardent le contrôle', body: "Les parents donnent leur accord avant que les dossiers soient conservés, voient la croissance de leur enfant expliquée simplement et peuvent demander une visite à tout moment." },
      ],
      closing: "Les comptes des agents de santé sont créés par le superviseur du camp. Les parents peuvent s'inscrire ; un infirmier de leur camp les approuve.",
    },
    footer: { tagline: 'signifie « bébé » en kinyarwanda.' },
    contact: {
      title: 'Contact',
      body: "Une question sur Ikibondo ou sur votre compte ? Demandez à l'infirmier du centre de santé de votre camp, ou contactez l'équipe du programme.",
    },
  },

  // DRAFT — to be reviewed by a native Kinyarwanda speaker (docs/i18n.md)
  rw: {
    'home.hero': {
      title: "Menya kare umwana udakura neza mbere y'uko biba ibyago bikomeye.",
      body: "Ikibondo ni aho abajyanama b'ubuzima, abaforomo n'abagenzuzi bo mu nkambi z'impunzi mu Rwanda bandika buri gipimo, bakakigereranya n'ibipimo by'imikurire bya OMS, bakabona abana bakeneye ubufasha mbere.",
      primary_cta: 'Injira',
      secondary_cta: "Iyandikishe nk'umubyeyi",
      note: "Konti z'abakozi b'ubuzima zifungurwa n'umugenzuzi w'inkambi yawe.",
    },
    'home.how_it_works': {
      title: "Kuva ku gusura urugo kugeza ku kohereza umwana",
      subtitle: "Buri gipimo umukozi w'ubuzima afata kigera ku bashobora gufata icyemezo.",
      steps: [
        {
          title: "Umukozi w'ubuzima apima umwana",
          description: "Abajyanama b'ubuzima basura imiryango yo mu gace kabo bakandika ibiro, uburebure, MUAC, kubyimba n'ibimenyetso kuri telefoni. Gusura kubikwa n'iyo nta murandasi, kukoherezwa umurandasi ugarutse.",
        },
        {
          title: 'Ikibondo gisuzuma ibipimo',
          description: "Buri gusura kugereranywa n'ibipimo by'imikurire bya OMS, umwana agashyirwa mu cyiciro cy'ibyago bike, biringaniye cyangwa byinshi. Impamvu z'icyo cyiciro zisobanurwa mu magambo yoroshye kugira ngo umuforomo azigenzure.",
        },
        {
          title: 'Ubikwiye amenyeshwa',
          description: "Abaforomo n'abagenzuzi bamenyeshwa uwo munsi abana bafite ibyago byinshi. Ababyeyi bibutswa mbere ya buri rukingo.",
        },
      ],
    },
    'home.roles': {
      title: "Ibyo buri wese abona iyo yinjiye",
      roles: [
        {
          role: "Abajyanama b'ubuzima",
          description: "Bandika gusura n'ibipimo, kandi bakabona umwana basuzumye ikarita ye ya QR. Bikora no mu cyaro nta murandasi.",
          features: "Gusura nta murandasi; Gushakisha ukoresheje QR; Ibyago nyuma ya buri gusura",
        },
        {
          role: 'Abaforomo',
          description: "Basuzuma amadosiye, bakongeraho inyandiko z'ubuvuzi, bategura iminsi y'ikingira kandi bakabona impamvu umwana yahawe icyiciro cy'ibyago.",
          features: "Impamvu z'ingenzi za buri cyiciro; Inyandiko z'ubuvuzi; Imbonerahamwe y'imikurire ya OMS",
        },
        {
          role: 'Abagenzuzi',
          description: "Bakurikirana ibikorwa by'abajyanama b'ubuzima mu duce, bagasubiza ku bana bafite ibyago byinshi kandi bagategura raporo.",
          features: "Ibikorwa by'abajyanama; Abana bafite ibyago byinshi; Raporo",
        },
        {
          role: 'Ababyeyi n\'abarera abana',
          description: "Babona imikurire n'ikarita y'inkingo by'umwana wabo, bakibutswa kuri SMS kandi bagasaba umujyanama w'ubuzima kubasura.",
          features: "Imikurire mu magambo yoroshye; Ikarita y'inkingo; Kwibutswa kuri SMS",
        },
      ],
    },
    'home.muac': {
      title: "Soma agapimo ka MUAC nk'umukozi w'ubuzima",
      body: "Agapimo kazengurutswa hagati y'ukuboko kw'umwana hejuru y'inkokora. Ibara rigaragaza icyo umukozi w'ubuzima akora. Imura akamenyetso urebe buri bara.",
    },
    about: {
      title: "Amakarita y'imikurire y'impapuro arabura. Abana ntibakwiye kubura.",
      intro_1: "Mu nkambi irimo abantu benshi, ibiro by'umwana bishobora kwandikwa ku ikarita imwe ku gusura kumwe, no ku yindi ku gukurikira. Iyo amadosiye atatanye, umwana udakura neza ashobora kutamenyekana kugeza arwaye cyane.",
      intro_2: "Ikibondo kibika idosiye imwe kuri buri mwana, abakozi b'ubuzima bose bo mu nkambi bashobora kubona. Buri gipimo gishya kigereranywa n'ibipimo bya OMS kikimara kubikwa, ku buryo abana bakeneye ubufasha bagaragara uwo munsi.",
      principles_title: 'Ibyo twubahiriza',
      principles: [
        { title: 'Umuforomo ni we ufata icyemezo', body: "Icyiciro cy'ibyago ni ugusaba kureba neza, si isuzuma rya muganga. Buri cyiciro cyerekana ibipimo cyashingiyeho kugira ngo umuganga agenzure kandi ashobore kugihindura." },
        { title: 'Bikora nta murandasi', body: "Abakozi b'ubuzima bakomeza kwandika gusura nta murandasi. Amadosiye yoherezwa iyo telefoni yongeye kubona umurandasi, nta kibuze." },
        { title: 'Imiryango igira ijambo', body: "Ababyeyi babanza kwemera mbere y'uko amadosiye abikwa, babona imikurire y'umwana mu magambo yoroshye kandi bashobora gusaba gusurwa igihe cyose." },
      ],
      closing: "Konti z'abakozi b'ubuzima zifungurwa n'umugenzuzi w'inkambi. Ababyeyi bashobora kwiyandikisha, bakemezwa n'umuforomo wo mu nkambi yabo.",
    },
    footer: { tagline: 'bisobanura « umwana muto » mu Kinyarwanda.' },
    contact: {
      title: 'Twandikire',
      body: "Ufite ikibazo kuri Ikibondo cyangwa kuri konti yawe? Baza umuforomo wo ku kigo nderabuzima cy'inkambi yawe, cyangwa wandikire itsinda rya porogaramu.",
    },
  },
};
