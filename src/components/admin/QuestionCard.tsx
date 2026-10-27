import type { Question } from '../../types';

interface Props {
  question: Question;
  index: number;
  onChange: (q: Question) => void;
  onRemove: () => void;
}

const nextKey = (options: Question['options']) => {
  for (let i = 0; i < 26; i += 1) {
    const key = String.fromCharCode(65 + i);
    if (!options.some((o) => o.key === key)) return key;
  }
  return 'X';
};

export default function QuestionCard({ question, index, onChange, onRemove }: Props) {
  const multiple = question.type === 'multiple';

  const setType = (type: Question['type']) => {
    if (type === 'trueFalse') {
      onChange({
        ...question,
        type,
        options: [
          { key: 'T', text: '是' },
          { key: 'F', text: '否' },
        ],
        correctKeys: [question.correctKeys[0] ?? 'T'],
      });
      return;
    }
    const options =
      question.type === 'trueFalse'
        ? [
            { key: 'A', text: '' },
            { key: 'B', text: '' },
            { key: 'C', text: '' },
          ]
        : question.options;
    onChange({ ...question, type, options, correctKeys: [options[0].key] });
  };

  const toggleCorrect = (key: string) => {
    if (multiple) {
      const has = question.correctKeys.includes(key);
      onChange({
        ...question,
        correctKeys: has ? question.correctKeys.filter((k) => k !== key) : [...question.correctKeys, key],
      });
    } else {
      onChange({ ...question, correctKeys: [key] });
    }
  };

  return (
    <div className="q-card">
      <div className="q-card-head">
        <span className="q-num">第 {index + 1} 題</span>
        <select
          className="select"
          value={question.type}
          onChange={(e) => setType(e.target.value as Question['type'])}
        >
          <option value="single">單選</option>
          <option value="multiple">多選（全對才得分）</option>
          <option value="trueFalse">是非</option>
        </select>
        <button type="button" className="btn tiny ghost danger" onClick={onRemove}>
          刪除題目
        </button>
      </div>

      <label className="field">
        <span>題目</span>
        <input
          className="input"
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="例：本段提到的三個重點，不包括下列哪一項？"
        />
      </label>

      <div className="opt-list">
        {question.options.map((opt) => (
          <div className="opt-row" key={opt.key}>
            <label className="opt-correct" title={multiple ? '可複選' : '單選'}>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={`correct-${question.qid}`}
                checked={question.correctKeys.includes(opt.key)}
                onChange={() => toggleCorrect(opt.key)}
              />
            </label>
            <span className="opt-key">{opt.key}</span>
            <input
              className="input"
              value={opt.text}
              onChange={(e) =>
                onChange({
                  ...question,
                  options: question.options.map((o) => (o.key === opt.key ? { ...o, text: e.target.value } : o)),
                })
              }
              placeholder="選項內容"
            />
            <button
              type="button"
              className="btn tiny ghost"
              disabled={question.options.length <= 2 || question.type === 'trueFalse'}
              onClick={() =>
                onChange({
                  ...question,
                  options: question.options.filter((o) => o.key !== opt.key),
                  correctKeys: question.correctKeys.filter((k) => k !== opt.key),
                })
              }
            >
              移除
            </button>
          </div>
        ))}
      </div>

      <div className="q-card-foot">
        <button
          type="button"
          className="btn tiny"
          disabled={question.type === 'trueFalse'}
          onClick={() =>
            onChange({ ...question, options: [...question.options, { key: nextKey(question.options), text: '' }] })
          }
        >
          ＋ 新增選項
        </button>
        <input
          className="input q-explain"
          value={question.explanation ?? ''}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="答完後顯示的說明（可留空）"
        />
      </div>
    </div>
  );
}
