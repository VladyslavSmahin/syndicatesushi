import s from "./admin.module.css";

export default function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className={s.card}>
      <div className={s.placeholder}>
        <div className={s.placeholderTitle}>{title}</div>
        <p className={s.hint} style={{ maxWidth: 460, margin: "0 auto" }}>{text}</p>
        <p className={s.hint} style={{ marginTop: 14, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>
          Запрацює після підключення Supabase
        </p>
      </div>
    </div>
  );
}
