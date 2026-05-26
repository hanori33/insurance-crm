// src/pages/MorePage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { COLORS } from '../constants';
import { Divider } from '../components/Common';
import Modal from '../components/Modal';
import Field from '../components/Field';
import authService from '../services/authService';
import { supabase } from '../supabaseClient';

function ProfileAvatar({ src, name, size = 60 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {(name || '?').charAt(0)}
    </div>
  );
}

function ProfileEditModal({ visible, onClose, profile, onSave }) {
  const [name, setName] = useState(profile.name || '');
  const [position, setPosition] = useState(profile.position || '');
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');
  const [preview, setPreview] = useState(profile.photoUrl || '');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    setName(profile.name || '');
    setPosition(profile.position || '');
    setPhotoUrl(profile.photoUrl || '');
    setPreview(profile.photoUrl || '');
    setFile(null);
  }, [profile, visible]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);

    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  async function handleSave() {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('로그인이 필요합니다.');

      let uploadedUrl = photoUrl || '';

      if (file) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `avatars/${user.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(path, file, {
            upsert: true,
            cacheControl: '0',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('profiles')
          .getPublicUrl(path);

        uploadedUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: name.trim(),
          position: position.trim(),
          photo_url: uploadedUrl,
        },
      });

      if (authError) throw authError;

    console.log('현재 로그인 user.id:', user.id);

const { data: profileRows } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', user.id);

console.log('찾은 profiles:', profileRows);

const { error: profileError } = await supabase
  .from('profiles')
  .update({
    name: name.trim(),
    photo_url: uploadedUrl,
  })
  .eq('user_id', user.id);

if (profileError) throw profileError;
    
      await supabase.auth.refreshSession();

      onSave({
        name: name.trim(),
        position: position.trim(),
        photoUrl: uploadedUrl,
      });

      onClose();
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="프로필 수정">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div style={{ position: 'relative' }}>
          <ProfileAvatar src={preview} name={name} size={80} />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: COLORS.primary,
              color: '#fff',
              border: '2px solid #fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            ✏️
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            marginTop: 10,
            background: 'none',
            border: 'none',
            color: COLORS.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          사진 변경
        </button>
      </div>

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
        이름
      </span>
      <Field
        icon="👤"
        placeholder="이름을 입력하세요"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
        직급
      </span>
      <Field
        icon="💼"
        placeholder="직급 (예: 팀장, 수석 설계사)"
        value={position}
        onChange={e => setPosition(e.target.value)}
      />

      <div style={{ height: 10 }} />

      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: 'none',
          background: COLORS.primary,
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '저장 중...' : '저장'}
      </button>
    </Modal>
  );
}

function MenuItem({ icon, label, onClick, danger, isLast }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          cursor: 'pointer',
          background: COLORS.white,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>{icon}</span>
          <span style={{ fontWeight: 500, fontSize: 15, color: danger ? '#DC2626' : COLORS.text }}>
            {label}
          </span>
        </div>
        <span style={{ color: COLORS.textLight, fontSize: 16 }}>›</span>
      </div>

      {!isLast && <Divider style={{ margin: '0 20px' }} />}
    </>
  );
}

export default function MorePage({ user, onNavigate }) {
  const meta = user?.user_metadata || {};

  const [profile, setProfile] = useState({
    name: meta.display_name || user?.email || '사용자',
    position: meta.position || '',
    photoUrl: meta.photo_url || '',
  });

  const [showEdit, setShowEdit] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;

      const { data } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      setProfile({
        name: data?.name || meta.display_name || user?.email || '사용자',
        position: meta.position || '',
        photoUrl: data?.photo_url || meta.photo_url || '',
      });
    }

    loadProfile();
  }, [user?.id]);

  async function handleLogout() {
    if (!window.confirm('로그아웃하시겠습니까?')) return;

    setLoggingOut(true);

    try {
      await authService.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingOut(false);
    }
  }

  const isAdmin = user?.email === 'gksmf629@naver.com';

  const menuItems = [
    { icon: '🔔', label: '알림 설정', onClick: () => onNavigate('notifSettings') },
    { icon: '☁️', label: '백업 / 복원', onClick: () => onNavigate('backupRestore') },
    { icon: '💬', label: '문의하기 / 오류 제보', onClick: () => onNavigate('inquiry') },

    ...(isAdmin
      ? [
          {
            icon: '📮',
            label: '관리자 문의함',
            onClick: () => onNavigate('adminInquiry'),
          },
        ]
      : []),

    {
      icon: '📄',
      label: '개인정보처리방침',
      onClick: () => onNavigate('privacyPolicy'),
    },
    {
      icon: '🗑️',
      label: '계정 삭제',
      onClick: () => onNavigate('deleteAccount'),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            background: COLORS.white,
            padding: '14px 20px',
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>더보기</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingBottom: 120,
            }}
          >
            <div
              onClick={() => setShowEdit(true)}
              style={{
                background: COLORS.white,
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 14px rgba(124,92,252,0.08)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ProfileAvatar src={profile.photoUrl} name={profile.name} size={52} />

                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>
                    {profile.name}
                  </div>

                  {profile.position && (
                    <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
                      {profile.position}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: COLORS.primary, fontWeight: 600 }}>편집</span>
                <span style={{ color: COLORS.textLight }}>›</span>
              </div>
            </div>

            <div
              style={{
                background: COLORS.white,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 14px rgba(124,92,252,0.08)',
              }}
            >
              {menuItems.map((item, i) => (
                <MenuItem key={i} {...item} isLast={i === menuItems.length - 1} />
              ))}
            </div>

            <div
              style={{
                background: COLORS.white,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 2px 14px rgba(124,92,252,0.08)',
              }}
            >
              <MenuItem
                icon="🚪"
                label={loggingOut ? '로그아웃 중...' : '로그아웃'}
                onClick={handleLogout}
                danger
                isLast
              />
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.textLight }}>
              버전 1.0.0
            </div>
          </div>
        </div>
      </div>

      <ProfileEditModal
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        profile={profile}
        onSave={setProfile}
      />
    </>
  );
}