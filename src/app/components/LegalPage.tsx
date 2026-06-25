import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { getLegalDocument, type LegalDocumentType } from '../legal/legalDocuments';

interface Props {
  type: LegalDocumentType;
  onBack: () => void;
}

export function LegalPage({ type, onBack }: Props) {
  const document = getLegalDocument(type);
  const Icon = document.type === 'privacy' ? ShieldCheck : FileText;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0A0E1A', padding: '52px 20px 40px' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="返回账户设置" style={iconButtonStyle}><ArrowLeft size={17} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#E2EAF8', fontSize: 18, fontWeight: 800 }}>{document.title}</div>
          <div style={{ color: '#6B80A8', fontSize: 10, marginTop: 2 }}>版本 {document.version} · 生效日期 {document.effectiveDate}</div>
        </div>
      </div>

      <section style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,rgba(0,201,177,0.14),rgba(8,145,178,0.06))', border: '1px solid rgba(0,201,177,0.18)', display: 'flex', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(0,201,177,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color="#00C9B1" />
        </div>
        <div>
          <div style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 800 }}>文档摘要</div>
          <div style={{ color: '#8EA4C6', fontSize: 10, lineHeight: 1.6, marginTop: 4 }}>{document.summary}</div>
          <div style={{ color: '#00C9B1', fontSize: 9, marginTop: 7 }}>更新日期：{document.updatedAt}</div>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
        {document.sections.map((section, index) => (
          <section key={section.title} style={{ padding: 15, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 style={{ margin: 0, color: '#E2EAF8', fontSize: 13, fontWeight: 800 }}>{index + 1}. {section.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>
              {section.body.map((paragraph) => (
                <p key={paragraph} style={{ margin: 0, color: '#8EA4C6', fontSize: 10, lineHeight: 1.65 }}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const iconButtonStyle = { width: 34, height: 34, borderRadius: 17, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#E2EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
