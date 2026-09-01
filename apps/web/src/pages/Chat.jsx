import { useEffect, useRef, useState } from 'react';
import { TopBar, Card, Empty, Note } from '../ui/bits.jsx';
import { useSession } from '../lib/session.jsx';
import {
  myConversation, listConversationMessages, sendConversationMessage, reportConversation,
  subscribeConversationMessages,
} from '../lib/api.js';

const REASONS = {
  harassment: '불쾌한 접근', private_contact: '개인 연락 유도', inappropriate: '부적절한 내용', other: '기타',
};

export default function Chat() {
  const { session } = useSession();
  const [thread, setThread] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [flash, setFlash] = useState('');
  const endRef = useRef(null);
  const photoInputRef = useRef(null);

  const load = async () => {
    setThread(undefined);
    setFlash('');
    try {
      const next = await myConversation(session.role);
      setThread(next);
      setMessages(next ? await listConversationMessages(next.id) : []);
    } catch (error) {
      setThread(null);
      setFlash(error.message || '대화를 불러오지 못했습니다.');
    }
  };

  useEffect(() => { load(); }, [session.role]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  useEffect(() => {
    if (!thread?.id) return undefined;
    return subscribeConversationMessages(thread.id, (message) => {
      setMessages((prev) => prev.some((item) => item.id === message.id) ? prev : [...prev, message]);
    });
  }, [thread?.id]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return undefined; }
    const objectUrl = URL.createObjectURL(photo);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  async function submit(e) {
    e.preventDefault();
    if ((!text.trim() && !photo) || !thread) return;
    setBusy(true);
    try {
      const row = await sendConversationMessage(thread.id, text, session.id, photo);
      setMessages((prev) => prev.some((item) => item.id === row.id) ? prev : [...prev, row]);
      setText('');
      setPhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (row.masked) setFlash('개인 연락처로 보이는 내용은 안전을 위해 가려졌습니다.');
    } catch (error) {
      setFlash(error?.message || '메시지를 보내지 못했습니다.');
    } finally { setBusy(false); }
  }

  async function report(reason) {
    try {
      await reportConversation(thread.id, reason, `${REASONS[reason]} 신고`);
      setReporting(false);
      setFlash('신고가 접수되었습니다. 운영팀이 대화 기록을 확인합니다.');
    } catch (error) {
      setFlash(error.message || '신고를 접수하지 못했습니다.');
    }
  }

  if (thread === undefined) return <><TopBar title="대화" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  return (
    <>
      <TopBar
        title={thread?.counterpart ?? '대화'}
        sub="연락처를 나누지 않아도 안전하게 관리할 수 있어요"
        right={thread && <button className="btn btn--ghost btn--sm" onClick={() => setReporting((v) => !v)}>신고</button>}
      />

      {flash && <Note kind="go"><p className="small">{flash}</p></Note>}

      {!thread ? (
        <Card><Empty title={flash ? '대화를 불러오지 못했습니다' : '아직 연결된 대화가 없습니다'} action={flash ? <button type="button" className="btn btn--sm" onClick={load}>다시 불러오기</button> : undefined}>{flash || 'PT 매칭 후 담당 트레이너와 대화할 수 있습니다.'}</Empty></Card>
      ) : (
        <>
          {reporting && (
            <Card title="신고 사유" note="상대방에게 알리지 않고 운영팀이 확인합니다">
              <div className="row row--wrap">
                {Object.entries(REASONS).map(([reason, label]) => (
                  <button key={reason} className="btn btn--ghost btn--sm" onClick={() => report(reason)}>{label}</button>
                ))}
              </div>
            </Card>
          )}

          <div className="chat-log" aria-live="polite">
            <p className="chat-log__date">앱 안에서만 대화가 보관됩니다</p>
            {messages.map((message) => {
              const mine = message.sender_id === session.id;
              return (
                <div key={message.id} className={`bubble-row ${mine ? 'bubble-row--mine' : ''}`}>
                  <div className={`bubble ${mine ? 'bubble--mine' : ''}`}>
                    {message.image_src && (
                      <a className="bubble__photo-link" href={message.image_src} target="_blank" rel="noreferrer" aria-label="사진 크게 보기">
                        <img className="bubble__photo" src={message.image_src} alt="대화에 첨부된 사진" loading="lazy" />
                      </a>
                    )}
                    {message.body && <span className="bubble__text">{message.body}</span>}
                    {message.masked && <small>개인 연락처 가림</small>}
                  </div>
                  <time>{new Date(message.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form className="chat-compose" onSubmit={submit}>
            {photoPreview && (
              <div className="chat-compose__preview">
                <img src={photoPreview} alt="보낼 사진 미리보기" />
                <button type="button" aria-label="첨부 사진 지우기" onClick={() => {
                  setPhoto(null);
                  if (photoInputRef.current) photoInputRef.current.value = '';
                }}>×</button>
              </div>
            )}
            <input
              ref={photoInputRef}
              className="sr"
              id="chat-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <label className="chat-compose__photo" htmlFor="chat-photo" aria-label="사진 추가" title="사진 추가">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h4l1.5-2h5l1.5 2h4v13H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
            </label>
            <label className="sr" htmlFor="chat-message">메시지</label>
            <textarea
              id="chat-message" className="input" rows="2" maxLength="1000"
              placeholder="운동·식단·예약에 대해 이야기하세요"
              value={text} onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" disabled={busy || (!text.trim() && !photo)}>{busy ? '…' : '보내기'}</button>
          </form>
        </>
      )}
    </>
  );
}
