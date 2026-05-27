// src/pages/NoticesPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, Divider, LoadingSpinner } from '../components/Common';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import NoticeForm from '../components/NoticeForm';
import noticeService from '../services/noticeService';

export default function NoticesPage({ user }) {
  const [notices, setNotices] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [myRole, setMyRole] = useState('agent');
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [editingNotice, setEditingNotice] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const userName =
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    '사용자';

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const [noticeList, readIdList, role] = await Promise.all([
        noticeService.list().catch(() => []),
        noticeService.getReadIds().catch(() => []),
        noticeService.getMyRole().catch(() => 'agent'),
      ]);

      setNotices(noticeList);
      setReadIds(readIdList);
      setMyRole(role);
    } finally {
      setLoading(false);
    }
  }

  const canWrite = [
    'superadmin',
    'division_head',
    'branch_head',
    'office_head',
    'team_leader',
  ].includes(myRole);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 17,
            color: COLORS.text,
          }}
        >
          공지사항
        </span>

        {canWrite && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              borderRadius: 999,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + 공지 작성
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {loading ? (
          <LoadingSpinner />
        ) : notices.length === 0 ? (
          <EmptyState icon="📢" message="공지사항이 없습니다" />
        ) : (
          <Card style={{ padding: 0 }}>
            {notices.map((n, i) => {
              const isRead = readIds.includes(n.id);

              return (
                <React.Fragment key={n.id}>
                  <div
                    onClick={async () => {
                      if (!isRead) {
                        await noticeService.markAsRead(n.id);
                        setReadIds((prev) => [...prev, n.id]);
                      }

                      setSelectedNotice(n);
                    }}
                    style={{
                      padding: '14px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: COLORS.text,
                          }}
                        >
                          {n.title}
                        </span>

                        {!isRead && (
                          <span
                            style={{
                              background: '#EF4444',
                              color: '#fff',
                              borderRadius: 999,
                              padding: '2px 7px',
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.textGray,
                          marginTop: 4,
                        }}
                      >
                        {n.content.split('\n')[0].slice(0, 60)}
                        {n.content.split('\n')[0].length > 60
                          ? '...'
                          : ''}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: COLORS.textLight,
                          marginTop: 4,
                        }}
                      >
                        {n.author_name} ({n.author_role}) ·{' '}
                        {new Date(n.created_at).toLocaleDateString(
                          'ko-KR'
                        )}
                      </div>
                    </div>
                  </div>

                  {i < notices.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </Card>
        )}
      </div>

      {/* 공지 상세 */}
      {selectedNotice && (
        <Modal
          visible={!!selectedNotice}
          onClose={() => setSelectedNotice(null)}
          title="공지사항"
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            {selectedNotice.title}
          </div>

          <div
            style={{
              fontSize: 12,
              color: COLORS.textGray,
              marginBottom: 16,
            }}
          >
            {selectedNotice.author_name} (
            {selectedNotice.author_role}) ·{' '}
            {new Date(
              selectedNotice.created_at
            ).toLocaleDateString('ko-KR')}
          </div>

          <div
            style={{
              fontSize: 14,
              color: COLORS.text,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              background: COLORS.bg,
              borderRadius: 12,
              padding: 16,
            }}
          >
            {selectedNotice.content}
          </div>

          {(selectedNotice.author_id === user?.id ||
            myRole === 'superadmin') && (
            <button
              onClick={() => {
                setEditingNotice(selectedNotice);
                setEditTitle(selectedNotice.title || '');
                setEditContent(selectedNotice.content || '');
              }}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              수정
            </button>
          )}

          {myRole === 'superadmin' && (
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    '공지사항을 삭제할까요?'
                  )
                )
                  return;

                await noticeService.remove(
                  selectedNotice.id
                );

                setNotices((prev) =>
                  prev.filter(
                    (n) => n.id !== selectedNotice.id
                  )
                );

                setSelectedNotice(null);
              }}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                background: '#FEE2E2',
                color: '#DC2626',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          )}
        </Modal>
      )}

      {/* 공지 수정 */}
      {editingNotice && (
        <Modal
          visible={!!editingNotice}
          onClose={() => setEditingNotice(null)}
          title="공지 수정"
        >
          <input
            value={editTitle}
            onChange={(e) =>
              setEditTitle(e.target.value)
            }
            placeholder="제목"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              marginBottom: 12,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />

          <textarea
            value={editContent}
            onChange={(e) =>
              setEditContent(e.target.value)
            }
            placeholder="내용"
            rows={8}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              fontSize: 14,
              resize: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />

          <button
            onClick={async () => {
              try {
                await noticeService.update(
                  editingNotice.id,
                  {
                    title: editTitle,
                    content: editContent,
                  }
                );

                await load();

                setEditingNotice(null);
                setSelectedNotice(null);
              } catch (e) {
                console.error(e);
                alert('수정 실패');
              }
            }}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: COLORS.primary,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            수정 저장
          </button>
        </Modal>
      )}

      {/* 공지 작성 */}
      <NoticeForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        myRole={myRole}
        userName={userName}
        onSave={async () => {
          const [noticeList, readIdList] =
            await Promise.all([
              noticeService.list().catch(() => []),
              noticeService.getReadIds().catch(
                () => []
              ),
            ]);

          setNotices(noticeList);
          setReadIds(readIdList);
          setShowForm(false);
        }}
      />
    </div>
  );
}