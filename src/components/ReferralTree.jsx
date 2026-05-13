
import React from 'react';
import { COLORS } from '../constants';
import { Avatar } from './Common';

function VLine({ h = 20 }) {
  return <div style={{ width: 2, height: h, background: COLORS.primaryLighter, margin: '0 auto' }} />;
}
function HLine({ w = '55%' }) {
  return <div style={{ height: 2, background: COLORS.primaryLighter, width: w, margin: '0 auto' }} />;
}

function NodeBox({ node, isRoot }) {
  return (
    <div style={{ background: COLORS.white, borderRadius: isRoot ? 16 : 14, padding: isRoot ? '14px 20px' : '10px 14px', boxShadow: '0 2px 14px rgba(124,92,252,0.10)', display: 'flex', alignItems: 'center', gap: isRoot ? 12 : 8, minWidth: isRoot ? 160 : 100 }}>
      <Avatar name={node.name} size={isRoot ? 44 : 32} />
      <div>
        <div style={{ fontWeight: 700, fontSize: isRoot ? 15 : 13, color: COLORS.text }}>{node.name}</div>
        {isRoot && <div style={{ fontSize: 11, color: COLORS.textGray }}>나 ({node.name})</div>}
        <div style={{ fontSize: 11, color: COLORS.primary, marginTop: 2 }}>👥 {node.count}명</div>
      </div>
    </div>
  );
}

function Leaf({ node }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <VLine h={14} />
      <div style={{ background: COLORS.white, borderRadius: 12, padding: '8px 12px', boxShadow: '0 2px 10px rgba(124,92,252,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
        <Avatar name={node.name} size={28} />
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>{node.name}</div>
        <div style={{ fontSize: 10, color: COLORS.primary }}>{node.count}명</div>
      </div>
    </div>
  );
}

export default function ReferralTree({ data }) {
  if (!data) return null;
  const level1 = data.children || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeBox node={data} isRoot />
      {level1.length > 0 && (
        <>
          <VLine h={20} />
          {level1.length > 1 && <HLine w="55%" />}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {level1.map((n, i) => (
              <div key={n.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <VLine h={20} />
                <NodeBox node={n} />
                {(n.children || []).length > 0 && (
                  <>
                    <VLine h={14} />
                    {n.children.length > 1 && <HLine w="65%" />}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {n.children.map((c, ci) => <Leaf key={c.id || ci} node={c} />)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}