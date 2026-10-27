import { useEffect, useState } from 'react';
import { fmtTime, parseTime } from '../lib/format';

interface Props {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}

/** 時間輸入框：可打 90、1:30 或 1:02:03，失焦或按 Enter 才轉成秒 */
export default function TimeInput({ value, onChange, placeholder }: Props) {
  const [text, setText] = useState(fmtTime(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmtTime(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseTime(text);
    if (parsed === null) {
      setText(fmtTime(value));
      return;
    }
    const sec = Math.max(0, Math.round(parsed));
    onChange(sec);
    setText(fmtTime(sec));
  };

  return (
    <input
      className="input mono"
      value={text}
      placeholder={placeholder ?? '0:00'}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
