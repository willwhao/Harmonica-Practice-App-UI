export type LegalDocumentType = 'privacy' | 'terms';

export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalDocument {
  type: LegalDocumentType;
  title: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_EFFECTIVE_DATE = '2026-06-24';
export const LEGAL_VERSION = '1.0.0';

export const PRIVACY_POLICY: LegalDocument = {
  type: 'privacy',
  title: '隐私政策',
  version: LEGAL_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  updatedAt: LEGAL_EFFECTIVE_DATE,
  summary: '说明口琴练习应用如何处理账户、练习、麦克风、录音、上传音频、云同步和错误监控相关数据。',
  sections: [
    {
      title: '我们收集和处理的数据',
      body: [
        '账户数据：邮箱、昵称、练习偏好、创建时间，以及用于保持登录状态的访问令牌和 HttpOnly 刷新令牌。',
        '练习数据：曲目、分数、准确率、练习时间、时长、薄弱小节、难点书签和课程进度。',
        '设备与运行数据：浏览器能力、基础性能指标、错误信息、发布版本、运行环境和必要的技术日志。',
      ],
    },
    {
      title: '麦克风、录音与上传音频',
      body: [
        '麦克风音频默认只在浏览器内用于实时音高识别，不会自动上传到服务器。',
        '练习录音仅用于本次结果页回放和错音定位，当前实现使用临时 Object URL，刷新页面后不保留。',
        '上传音频识谱功能在浏览器内解码和识别，生成的简谱草稿需要用户自行确认版权与准确性。',
      ],
    },
    {
      title: '云同步与账户数据',
      body: [
        '云端模式会同步练习历史、难点书签、课程进度和账户偏好，用于跨设备恢复学习状态。',
        '用户可以在账户页导出本地账户数据，或删除账户及其关联练习记录。',
        '刷新令牌通过 HttpOnly Cookie 保存，服务端会在刷新时轮换令牌并拒绝重放。',
      ],
    },
    {
      title: '错误监控与安全',
      body: [
        '应用会记录脚本错误、未处理异步错误、恢复操作和基础性能事件，用于定位问题和改进稳定性。',
        '远端错误监控受功能开关、采样率和监控接收端配置控制；监控事件不应包含用户密码或原始音频。',
        '服务端接口使用速率限制、输入校验和安全响应头降低滥用风险。',
      ],
    },
    {
      title: '用户权利与联系我们',
      body: [
        '你可以请求访问、导出、更正或删除自己的账户和练习数据。',
        '如需处理隐私请求，请通过产品发布页或支持邮箱联系维护者，并提供账户邮箱和问题说明。',
        '本政策更新时会调整版本号、生效日期和更新日期。',
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  type: 'terms',
  title: '用户协议',
  version: LEGAL_VERSION,
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  updatedAt: LEGAL_EFFECTIVE_DATE,
  summary: '说明使用口琴练习应用时的账户责任、内容版权、音频功能、云同步、免责声明和终止规则。',
  sections: [
    {
      title: '服务内容',
      body: [
        '本应用提供口琴曲库、练习判定、学习计划、难点复练、校准、新手引导、录音回放和云同步等功能。',
        '部分功能可能处于实验阶段，发布前会通过功能开关控制开放范围。',
      ],
    },
    {
      title: '账户与使用责任',
      body: [
        '用户应妥善保管账户凭据，不得使用本应用从事违法、侵权或破坏服务稳定性的行为。',
        '本地账户主要用于产品流程验证；云端账户用于跨设备同步和恢复学习状态。',
      ],
    },
    {
      title: '内容与版权',
      body: [
        '曲谱、伴奏、示范音轨和上传音频可能受版权保护。用户应确保自己拥有上传、识别或练习相关音频的合法权利。',
        '应用内自动识别的简谱草稿仅供学习参考，不构成官方谱面或版权授权。',
      ],
    },
    {
      title: '音频识别与练习结果',
      body: [
        '音高检测和评分结果会受到设备、环境噪声、麦克风、吹奏力度和算法限制影响，仅作为练习辅助。',
        '校准向导和个人音高校准表用于改善判定一致性，但不能保证所有设备和口琴完全准确。',
      ],
    },
    {
      title: '免责声明、变更与终止',
      body: [
        '在法律允许范围内，服务按现状提供。维护者会尽力保障稳定性，但不承诺服务永久不中断或完全无错误。',
        '如用户违反协议或存在安全风险，维护者可限制、暂停或终止相关服务。',
        '协议变更会通过版本号、生效日期和发布说明体现；继续使用视为接受更新后的条款。',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = [PRIVACY_POLICY, TERMS_OF_SERVICE] as const;

export function getLegalDocument(type: LegalDocumentType) {
  return LEGAL_DOCUMENTS.find((document) => document.type === type) ?? PRIVACY_POLICY;
}

export function summarizeLegalReadiness() {
  return {
    version: LEGAL_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    documents: LEGAL_DOCUMENTS.map((document) => document.type),
    complete: LEGAL_DOCUMENTS.every((document) => document.version && document.effectiveDate && document.sections.length > 0),
  };
}
