// Генерація PDF-каталогу товарів (клієнтська, через @react-pdf/renderer).
// Імпортується ліниво (dynamic import) лише при натисканні «Згенерувати».
import { Document, Page, View, Text, Font, StyleSheet, pdf } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf" },
    { src: "/fonts/Roboto-Medium.ttf", fontWeight: 500 },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: 700 },
  ],
});
// без переносів зі знаком дефіса (інакше react-pdf рве слова)
Font.registerHyphenationCallback((w) => [w]);

export interface PdfProduct {
  name: string; price: number; weight: string; pieces: string;
  kcal: number; protein: number; fat: number; carbs: number;
  desc: string; composition: string; available: boolean;
}
export interface PdfSubgroup { name: string | null; products: PdfProduct[]; }
export interface PdfCategory { name: string; subgroups: PdfSubgroup[]; }
export interface PdfIngredient { name: string; kcal: number | null; protein: number | null; fat: number | null; carbs: number | null; }
export interface CatalogData {
  title: string; date: string;
  show: { price: boolean; nutrition: boolean; descComposition: boolean };
  categories: PdfCategory[];
  ingredients: PdfIngredient[] | null;
}

const C = { ink: "#1a1a1a", soft: "#666", line: "#e2e2e2", accent: "#b8002e", band: "#f4f0ec" };
const st = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 8, color: C.ink, paddingTop: 40, paddingBottom: 34, paddingHorizontal: 28 },
  header: { position: "absolute", top: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingBottom: 6 },
  headerTitle: { fontSize: 9, fontWeight: 700, color: C.accent },
  headerMeta: { fontSize: 7, color: C.soft },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, textAlign: "center", fontSize: 7, color: C.soft },
  catTitle: { fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 8, marginBottom: 6 },
  subTitle: { fontSize: 9, fontWeight: 500, color: C.ink, marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: C.line },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48.5%", marginBottom: 7, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 8.5, fontWeight: 700, flex: 1, paddingRight: 6 },
  price: { fontSize: 8.5, fontWeight: 700, color: C.accent },
  meta: { fontSize: 7, color: C.soft, marginTop: 2 },
  desc: { fontSize: 7, color: "#444", marginTop: 2 },
  compos: { fontSize: 7, color: C.soft, marginTop: 2 },
  hidden: { fontSize: 6.5, color: C.accent, fontWeight: 500 },
  // таблиця інгредієнтів (2 колонки)
  ingWrap: { flexDirection: "row", justifyContent: "space-between" },
  ingCol: { width: "48.5%" },
  ingHeadRow: { flexDirection: "row", backgroundColor: C.band, paddingVertical: 3, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: C.line },
  ingRow: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 3, borderBottomWidth: 0.3, borderBottomColor: C.line },
  ingName: { flex: 1, fontSize: 7.5 },
  ingNum: { width: 26, fontSize: 7.5, textAlign: "right", color: C.soft },
  ingHeadName: { flex: 1, fontSize: 7, fontWeight: 700 },
  ingHeadNum: { width: 26, fontSize: 7, fontWeight: 700, textAlign: "right" },
});

const n1 = (n: number) => (Math.round(n * 10) / 10).toString();

function ProductCard({ p, show }: { p: PdfProduct; show: CatalogData["show"] }) {
  const meta: string[] = [];
  if (p.weight) meta.push(p.weight);
  if (p.pieces) meta.push(p.pieces);
  if (show.nutrition && p.kcal > 0) meta.push(`${Math.round(p.kcal)} ккал · Б ${n1(p.protein)} Ж ${n1(p.fat)} В ${n1(p.carbs)}`);
  return (
    <View style={st.card} wrap={false}>
      <View style={st.cardTop}>
        <Text style={st.name}>
          {p.name}
          {!p.available ? <Text style={st.hidden}>  (прихований)</Text> : null}
        </Text>
        {show.price ? <Text style={st.price}>{p.price > 0 ? `${p.price} ₴` : "—"}</Text> : null}
      </View>
      {meta.length ? <Text style={st.meta}>{meta.join("  •  ")}</Text> : null}
      {show.descComposition && p.desc ? <Text style={st.desc}>{p.desc}</Text> : null}
      {show.descComposition && p.composition ? <Text style={st.compos}>{p.composition}</Text> : null}
    </View>
  );
}

function IngredientsTable({ list }: { list: PdfIngredient[] }) {
  const mid = Math.ceil(list.length / 2);
  const cols = [list.slice(0, mid), list.slice(mid)];
  const Head = () => (
    <View style={st.ingHeadRow}>
      <Text style={st.ingHeadName}>Інгредієнт</Text>
      <Text style={st.ingHeadNum}>ккал</Text>
      <Text style={st.ingHeadNum}>Б</Text>
      <Text style={st.ingHeadNum}>Ж</Text>
      <Text style={st.ingHeadNum}>В</Text>
    </View>
  );
  return (
    <View style={st.ingWrap}>
      {cols.map((col, ci) => (
        <View key={ci} style={st.ingCol}>
          <Head />
          {col.map((g, i) => (
            <View key={i} style={st.ingRow}>
              <Text style={st.ingName}>{g.name}</Text>
              <Text style={st.ingNum}>{g.kcal ?? "—"}</Text>
              <Text style={st.ingNum}>{g.protein ?? "—"}</Text>
              <Text style={st.ingNum}>{g.fat ?? "—"}</Text>
              <Text style={st.ingNum}>{g.carbs ?? "—"}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CatalogDocument({ data }: { data: CatalogData }) {
  return (
    <Document title={data.title} author="Syndicate Sushi">
      <Page size="A4" style={st.page}>
        <View style={st.header} fixed>
          <Text style={st.headerTitle}>{data.title}</Text>
          <Text style={st.headerMeta}>{data.date}</Text>
        </View>
        <Text style={st.footer} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        {data.categories.map((cat, i) => (
          <View key={i} break={i > 0}>
            <Text style={st.catTitle}>{cat.name}</Text>
            {cat.subgroups.map((sg, j) => (
              <View key={j}>
                {sg.name ? <Text style={st.subTitle}>{sg.name}</Text> : null}
                <View style={st.grid}>
                  {sg.products.map((p, k) => <ProductCard key={k} p={p} show={data.show} />)}
                </View>
              </View>
            ))}
          </View>
        ))}
        {data.ingredients && data.ingredients.length ? (
          <View break>
            <Text style={st.catTitle}>Інгредієнти (КБЖУ на 100 г)</Text>
            <IngredientsTable list={data.ingredients} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function generateCatalogBlob(data: CatalogData): Promise<Blob> {
  return await pdf(<CatalogDocument data={data} />).toBlob();
}
