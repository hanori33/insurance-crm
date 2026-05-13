import { COLORS } from './constants';

// ── default export (기존 코드 호환) ─────────────
const S = {
  screen: { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background: COLORS.bg },
  scroll: { flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'14px 16px 32px', display:'flex', flexDirection:'column', gap:14 },
  pageHeader: { background:COLORS.white, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${COLORS.border}`, flexShrink:0 },
  pageTitle: { fontWeight:700, fontSize:17, color:COLORS.text },
  iconBtn: { background:'none', border:'none', fontSize:22, cursor:'pointer', color:COLORS.textGray, lineHeight:1, padding:0 },
  card: { background:COLORS.white, borderRadius:16, padding:16, boxShadow:`0 2px 14px ${COLORS.shadow}` },
  cardTitle: { fontWeight:700, fontSize:15, color:COLORS.text, marginBottom:12 },
  btnPrimary: { width:'100%', padding:'14px 0', borderRadius:12, border:'none', background:`linear-gradient(135deg,${COLORS.primaryLight},${COLORS.primaryDark})`, color:COLORS.white, fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(124,92,252,0.35)' },
  btnOutline: { width:'100%', padding:'13px 0', borderRadius:12, border:`1.5px solid ${COLORS.border}`, background:COLORS.white, color:COLORS.textGray, fontSize:15, fontWeight:600, cursor:'pointer' },
  btnDanger: { width:'100%', padding:'13px 0', borderRadius:12, border:'1.5px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', fontSize:15, fontWeight:600, cursor:'pointer' },
  fab: { width:52, height:52, borderRadius:'50%', background:COLORS.primary, color:COLORS.white, border:'none', fontSize:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 18px rgba(124,92,252,0.45)' },
  inputWrap: { display:'flex', alignItems:'center', gap:10, border:`1.5px solid ${COLORS.border}`, borderRadius:12, padding:'12px 16px', background:'#FAFAFA', marginBottom:10 },
  input: { border:'none', background:'none', outline:'none', flex:1, fontSize:14, color:COLORS.text },
  inputIcon: { color:COLORS.textGray, fontSize:16, flexShrink:0 },
  label: { fontSize:13, color:COLORS.textGray, marginBottom:6, display:'block' },
  textarea: { width:'100%', border:`1.5px solid ${COLORS.border}`, borderRadius:12, padding:'12px 14px', fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', color:COLORS.text, background:'#FAFAFA', fontFamily:'inherit' },
  searchBar: { flex:1, display:'flex', alignItems:'center', gap:8, background:COLORS.white, borderRadius:12, padding:'10px 14px', border:`1.5px solid ${COLORS.border}` },
  searchInput: { border:'none', background:'none', outline:'none', fontSize:13, flex:1, color:COLORS.text },
  filterRow: { display:'flex', gap:8, overflowX:'auto', paddingBottom:4, flexShrink:0 },
  divider: { height:1, background:COLORS.border },
  menuItem: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'15px 20px', cursor:'pointer', background:COLORS.white },
  menuLeft: { display:'flex', alignItems:'center', gap:14 },
};

export default S;

// ── named exports (기존 pages 파일 호환) ─────────
export const card = S.card;
export const btn  = S.btnPrimary;
export const inp  = S.inputWrap;

export const THEME = {
  primary:   COLORS.primary,
  text:      COLORS.text,
  textGray:  COLORS.textGray,
  textLight: COLORS.textLight,
  border:    COLORS.border,
  bg:        COLORS.bg,
  white:     COLORS.white,
  red:       COLORS.red,
  green:     COLORS.green,
  shadow:    COLORS.shadow,
};

export const privacyNotice = {
  fontSize: 11, color: COLORS.textGray,
  background: COLORS.bgGray, borderRadius: 8,
  padding: '8px 12px', lineHeight: 1.5,
};
