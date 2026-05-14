// src/pages/MorePage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { COLORS } from '../constants';
import { Divider } from '../components/Common';
import Modal from '../components/Modal';
import Field from '../components/Field';
import NoteForm from '../components/NoteForm';
import authService from '../services/authService';
import { supabase } from '../supabaseClient';

function ProfileAvatar({ src, name, size = 60 }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {(name || '?').charAt(0)}
    </div>
  );
}

function ProfileEditModal({ visible, onClose, profile, onSave }) {
  const [name, setName]         = useState(profile.name || '');
  const [position, setPosition] = useState(profile.position || '');
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');
  const [preview, setPreview]   = useState(profile.photoUrl || '');
  const [loading, setLoading]   = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    setName(profile.name || '');
    setPosition(profile.position || '');
    setPhotoUrl(profile.photoUrl || '');
    setPreview(profile.photoUrl || '');
  }, [profile, visible]);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setPreview(ev.target.result); setPhotoUrl(ev.target.result); };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: name, position, photo_url: photoUrl },
      });
      if (error) throw error;
      onSave({ name, position, photoUrl });
      onClose();
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="프로필 수정">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <ProfileAvatar src={preview} name={name} size={80} />
          <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: COLORS.primary, color: '#fff', border: '2px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✏️</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current.click()} style={{ marginTop: 10, background: 'none', border: 'none', color: COLORS.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>사진 변경</button>
      </div>
      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>이름</span>
      <Field icon="👤" placeholder="이름을 입력하세요" value={name} onChange={e => setName(e.target.value)} />
      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>직급</span>
      <Field icon="💼" placeholder="직급 (예: 팀장, 수석 설계사)" value={position} onChange={e => setPosition(e.target.value)} />
      <div style={{ height: 10 }} />
      <button onClick={handleSave} disabled={loading} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: COLORS.primary, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}

function MenuItem({ icon, label, onClick, danger, isLast }) {
  return (
    <>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: COLORS.white }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>{icon}</span>
          <span style={{ fontWeight: 500, fontSize: 15, color: danger ? '#DC2626' : COLORS.text }}>{label}</span>
        </div>
        <span style={{ color: COLORS.textLight, fontSize: 16 }}>›</span>
      </div>
      {!isLast && <Divider style={{ margin: '0 20px' }} />}
    </>
  );
}

export default function MorePage({ user, onNavigate }) {
  const meta = user?.user_metadata || {};
  const [profile, setProfile]       = useState({
    name:     meta.display_name || user?.email || '사용자',
    position: meta.position     || '',
    photoUrl: meta.photo_url    || '',
  });
  const [showEdit, setShowEdit]     = useState(false);
  const [showNote, setShowNote]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    setLoggingOut(true);
    try { await authService.signOut(); }
    catch(e) { console.error(e); }
    finally { setLoggingOut(false); }
  }

  const menuItems = [
    { icon: '✏️', label: '메모 관리',   onClick: () => setShowNote(true) },
    { icon: '📋', label: '보험 이력',   onClick: () => {} },
    { icon: '☁️', label: '백업 / 복원', onClick: () => {} },
    { icon: '🔔', label: '알림 설정',   onClick: () => {} },
    { icon: '📊', label: '통계',        onClick: () => onNavigate('sales') },
    { icon: '⚙️', label: '설정',        onClick: () => {} },
  { icon: '📞', label: '보험사 고객센터', onClick: () => onNavigate('insuranceContact') },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 헤더 */}
        <div style={{ background: COLORS.white, padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>더보기</span>
        </div>

        {/* 스크롤 영역 - 핵심: flex:1 + overflow:auto */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 120 }}>

            {/* 프로필 */}
            <div onClick={() => setShowEdit(true)} style={{ background: COLORS.white, borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 14px rgba(124,92,252,0.08)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ProfileAvatar src={profile.photoUrl} name={profile.name} size={52} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>{profile.name}</div>
                  {profile.position && <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>{profile.position}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>편집</span>
                <span style={{ color: COLORS.textLight }}>›</span>
              </div>
            </div>

            {/* 메뉴 */}
            <div style={{ background: COLORS.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 14px rgba(124,92,252,0.08)' }}>
              {menuItems.map((item, i) => (
                <MenuItem key={i} {...item} isLast={i === menuItems.length - 1} />
              ))}
            </div>

            {/* 로그아웃 */}
            <div style={{ background: COLORS.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 14px rgba(124,92,252,0.08)' }}>
              <MenuItem icon="🚪" label={loggingOut ? '로그아웃 중...' : '로그아웃'} onClick={handleLogout} danger isLast />
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.textLight }}>버전 1.0.0</div>
          </div>
        </div>
      </div>

      <ProfileEditModal visible={showEdit} onClose={() => setShowEdit(false)} profile={profile} onSave={setProfile} />
      <NoteForm visible={showNote} onClose={() => setShowNote(false)} onSave={() => {}} />
    </>
  );
}