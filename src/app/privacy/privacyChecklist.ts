export interface PrivacyChecklistItem {
  id: string;
  label: string;
  status: 'implemented' | 'partial' | 'planned';
  detail: string;
}

export function getPrivacyChecklist(): PrivacyChecklistItem[] {
  return [
    {
      id: 'local-audio-upload',
      label: '上传音频本地处理',
      status: 'implemented',
      detail: '上传的 MP3/WAV/M4A 仅在浏览器内解码和识别，不会自动上传到服务器。',
    },
    {
      id: 'practice-recording',
      label: '练习录音临时回放',
      status: 'implemented',
      detail: '本次练习录音仅生成临时 Object URL，刷新页面后不保留。',
    },
    {
      id: 'data-export',
      label: '数据导出',
      status: 'implemented',
      detail: '账户资料、练习历史和难点收藏可导出为 JSON。',
    },
    {
      id: 'account-deletion',
      label: '账户注销',
      status: 'implemented',
      detail: '本地账户可删除；云端模式已提供账户删除 API 调用。',
    },
    {
      id: 'formal-legal-docs',
      label: '正式隐私政策与用户协议',
      status: 'implemented',
      detail: '已提供版本化隐私政策与用户协议文本，并在账户页提供查看入口。',
    },
  ];
}

export function summarizePrivacyReadiness(items = getPrivacyChecklist()) {
  const implemented = items.filter((item) => item.status === 'implemented').length;
  const partial = items.filter((item) => item.status === 'partial').length;
  const planned = items.filter((item) => item.status === 'planned').length;
  return { total: items.length, implemented, partial, planned };
}
