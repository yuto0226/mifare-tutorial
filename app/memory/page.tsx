'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface MemoryBlock {
  block: number;
  sector: number;
  address: number;
  data: string;
  type: 'manufacturer' | 'data' | 'value' | 'trailer';
  description: string;
  keyA?: string;
  keyB?: string;
  accessBits?: string;
  valueInfo?: {
    value: number;
    valueInverted: number;
    valueBackup: number;
    addr: number;
    addrInverted: number;
    addrBackup: number;
    addrInvertedBackup: number;
    isValid: boolean;
    validationErrors: {
      valueInverted: boolean;
      valueBackup: boolean;
      addrInverted: boolean;
      addrBackup: boolean;
    };
  };
}

// 解析 Value Block 格式
const parseValueBlock = (data: string) => {
  if (data.length !== 32) return null;
  
  // 將十六進制字符串轉換為字節數組
  const bytes = data.match(/.{2}/g)?.map(hex => parseInt(hex, 16)) || [];
  if (bytes.length !== 16) return null;
  
  // 讀取 4 字節的值 (Little Endian) - 確保使用無符號 32 位元
  const value = ((bytes[0] + (bytes[1] << 8) + (bytes[2] << 16) + (bytes[3] << 24)) >>> 0);
  const valueInverted = ((bytes[4] + (bytes[5] << 8) + (bytes[6] << 16) + (bytes[7] << 24)) >>> 0);
  const valueBackup = ((bytes[8] + (bytes[9] << 8) + (bytes[10] << 16) + (bytes[11] << 24)) >>> 0);
  
  // 讀取地址字節
  const addr = bytes[12];
  const addrInverted = bytes[13];
  const addrBackup = bytes[14];
  const addrInvertedBackup = bytes[15];
  
  // 驗證格式 - 使用無符號 32 位元運算
  const valueValid = ((value ^ valueInverted) >>> 0) === 0xFFFFFFFF;
  const valueBackupValid = value === valueBackup;
  const addrValid = (addr ^ addrInverted) === 0xFF;
  const addrBackupValid = addr === addrBackup && addrInverted === addrInvertedBackup;
  
  return {
    value,
    valueInverted,
    valueBackup,
    addr,
    addrInverted,
    addrBackup,
    addrInvertedBackup,
    isValid: valueValid && valueBackupValid && addrValid && addrBackupValid,
    validationErrors: {
      valueInverted: !valueValid,
      valueBackup: !valueBackupValid,
      addrInverted: !addrValid,
      addrBackup: !addrBackupValid
    }
  };
};

// 建立 Value Block 格式的十六進制字串
const createValueBlock = (value: number, address: number = 0x06) => {
  // 確保值在 32 位元範圍內，使用無符號運算
  const val = (value >>> 0);
  const valInverted = ((~val) >>> 0);
  const addr = address & 0xFF;
  const addrInverted = (~addr) & 0xFF;
  
  // 將 32 位元值轉換為 Little Endian 格式的 4 個位元組
  const valueBytes = [
    val & 0xFF,
    (val >> 8) & 0xFF,
    (val >> 16) & 0xFF,
    (val >> 24) & 0xFF
  ];
  
  const valueInvertedBytes = [
    valInverted & 0xFF,
    (valInverted >> 8) & 0xFF,
    (valInverted >> 16) & 0xFF,
    (valInverted >> 24) & 0xFF
  ];
  
  // 組合成完整的 16 位元組格式
  const blockData = [
    ...valueBytes,        // 0-3: 值
    ...valueInvertedBytes, // 4-7: 值的反轉
    ...valueBytes,        // 8-11: 值的備份
    addr,                 // 12: 地址
    addrInverted,         // 13: 地址的反轉
    addr,                 // 14: 地址的備份
    addrInverted          // 15: 地址反轉的備份
  ];
  
  // 轉換為十六進制字串
  return blockData.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
};

// 模擬 Mifare Classic 1K 的記憶體佈局
const memoryData: MemoryBlock[] = [
  // 扇區 0 - 製造商區塊
  {
    block: 0, sector: 0, address: 0x00,
    data: "deadbeef220804006263646566676869",
    type: 'manufacturer',
    description: "製造商區塊：包含 UID、BCC、SAK 等製造商資訊",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  },
  // 扇區 0 - 資料區塊
  {
    block: 1, sector: 0, address: 0x01,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：用於儲存應用程式資料"
  },
  {
    block: 2, sector: 0, address: 0x02,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：用於儲存應用程式資料"
  },
  // 扇區 0 - 扇區尾塊 (預設設定)
  {
    block: 3, sector: 0, address: 0x03,
    data: "FFFFFFFFFFFF078069FFFFFFFFFFFF",
    type: 'trailer',
    description: "扇區尾塊：預設設定，所有區塊可讀寫",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  },
  // 扇區 1 - 公開讀取模式
  {
    block: 4, sector: 1, address: 0x04,
    data: "12345678901234567890123456789012",
    type: 'data',
    description: "資料區塊：公開讀取，需金鑰寫入"
  },
  (() => {
    const valueData = createValueBlock(100, 0x05);
    return {
      block: 5, sector: 1, address: 0x05,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：儲存餘額 100 元，增減值操作",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 6, sector: 1, address: 0x06,
    data: "ABCDEFABCDEFABCDEFABCDEFABCDEFAB",
    type: 'data',
    description: "資料區塊：公開讀取，需金鑰寫入"
  },
  {
    block: 7, sector: 1, address: 0x07,
    data: "A0A1A2A3A4A5787F07B0B1B2B3B4B5",
    type: 'trailer',
    description: "扇區尾塊：公開讀取模式 (存取位元: 787F07)",
    keyA: "A0A1A2A3A4A5",
    keyB: "B0B1B2B3B4B5",
    accessBits: "787F07"
  },
  // 扇區 2 - 只讀模式
  {
    block: 8, sector: 2, address: 0x08,
    data: "524541444F4E4C59444154414442434B",
    type: 'data',
    description: "資料區塊：只讀模式，無法寫入"
  },
  {
    block: 9, sector: 2, address: 0x09,
    data: "434F4E4649444D5F434F4E464947555F",
    type: 'data',
    description: "資料區塊：只讀模式，無法寫入"
  },
  {
    block: 10, sector: 2, address: 0x0A,
    data: "50524F54454354454452454144444154",
    type: 'data',
    description: "資料區塊：只讀模式，無法寫入"
  },
  {
    block: 11, sector: 2, address: 0x0B,
    data: "C1C2C3C4C5C6F87887C6C7C8C9CACB",
    type: 'trailer',
    description: "扇區尾塊：只讀模式 (存取位元: F87887)",
    keyA: "C1C2C3C4C5C6",
    keyB: "C6C7C8C9CACB",
    accessBits: "F87887"
  },
  // 扇區 3 - 需金鑰 B 讀寫模式
  {
    block: 12, sector: 3, address: 0x0C,
    data: "5345435552454441544144415441444B",
    type: 'data',
    description: "資料區塊：需金鑰 B 才能讀寫"
  },
  {
    block: 13, sector: 3, address: 0x0D,
    data: "4B45594244415441434345535345525F",
    type: 'data',
    description: "資料區塊：需金鑰 B 才能讀寫"
  },
  {
    block: 14, sector: 3, address: 0x0E,
    data: "4F4E4C59574954484B4559424143434D",
    type: 'data',
    description: "資料區塊：需金鑰 B 才能讀寫"
  },
  {
    block: 15, sector: 3, address: 0x0F,
    data: "D1D2D3D4D5D6877009D6D7D8D9DADB",
    type: 'trailer',
    description: "扇區尾塊：需金鑰 B 讀寫 (存取位元: 877009)",
    keyA: "D1D2D3D4D5D6",
    keyB: "D6D7D8D9DADB",
    accessBits: "877009"
  },
  // 扇區 4 - 遞增模式
  (() => {
    const valueData = createValueBlock(500, 0x10);
    return {
      block: 16, sector: 4, address: 0x10,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：僅允許遞增操作",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 17, sector: 4, address: 0x11,
    data: "494E4352454D454E544F4E4C59444154",
    type: 'data',
    description: "資料區塊：遞增模式設定"
  },
  {
    block: 18, sector: 4, address: 0x12,
    data: "56414C5545424C4F434B434F4E464947",
    type: 'data',
    description: "資料區塊：遞增模式設定"
  },
  {
    block: 19, sector: 4, address: 0x13,
    data: "E1E2E3E4E5E6C078F8E6E7E8E9EAEB",
    type: 'trailer',
    description: "扇區尾塊：遞增模式 (存取位元: C078F8)",
    keyA: "E1E2E3E4E5E6",
    keyB: "E6E7E8E9EAEB",
    accessBits: "C078F8"
  },
  // 扇區 5 - 遞減模式
  (() => {
    const valueData = createValueBlock(1000, 0x14);
    return {
      block: 20, sector: 5, address: 0x14,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：僅允許遞減操作",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 21, sector: 5, address: 0x15,
    data: "4445435245544F4E4C59444154424C43",
    type: 'data',
    description: "資料區塊：遞減模式設定"
  },
  {
    block: 22, sector: 5, address: 0x16,
    data: "56414C5545434F4E534D5245434E5446",
    type: 'data',
    description: "資料區塊：遞減模式設定"
  },
  {
    block: 23, sector: 5, address: 0x17,
    data: "F1F2F3F4F5F6C17CF1F6F7F8F9FAFB",
    type: 'trailer',
    description: "扇區尾塊：遞減模式 (存取位元: C17CF1)",
    keyA: "F1F2F3F4F5F6",
    keyB: "F6F7F8F9FAFB",
    accessBits: "C17CF1"
  },
  // 扇區 6 - 禁止存取模式
  {
    block: 24, sector: 6, address: 0x18,
    data: "464F5242494444454E414343455353444D",
    type: 'data',
    description: "資料區塊：禁止存取"
  },
  {
    block: 25, sector: 6, address: 0x19,
    data: "4E4F41434345535341434345535351433",
    type: 'data',
    description: "資料區塊：禁止存取"
  },
  {
    block: 26, sector: 6, address: 0x1A,
    data: "464F5242494444454E4F4E4C59415554",
    type: 'data',
    description: "資料區塊：禁止存取"
  },
  {
    block: 27, sector: 6, address: 0x1B,
    data: "010203040506FFF000060708090A0B",
    type: 'trailer',
    description: "扇區尾塊：禁止存取模式 (存取位元: FFF000)",
    keyA: "010203040506",
    keyB: "060708090A0B",
    accessBits: "FFF000"
  },
  // 扇區 7 - 金鑰 B 讀取模式
  {
    block: 28, sector: 7, address: 0x1C,
    data: "4B45594252454144494E474D4F444531",
    type: 'data',
    description: "資料區塊：金鑰 B 讀取模式"
  },
  {
    block: 29, sector: 7, address: 0x1D,
    data: "4B45594220434F4E54524F4C4C454453",
    type: 'data',
    description: "資料區塊：金鑰 B 讀取模式"
  },
  {
    block: 30, sector: 7, address: 0x1E,
    data: "52454144204F4E4C5920415554484F52",
    type: 'data',
    description: "資料區塊：金鑰 B 讀取模式"
  },
  {
    block: 31, sector: 7, address: 0x1F,
    data: "111213141516877F08161718191A1B",
    type: 'trailer',
    description: "扇區尾塊：金鑰 B 讀取模式 (存取位元: 877F08)",
    keyA: "111213141516",
    keyB: "161718191A1B",
    accessBits: "8F7F08"
  },
  // 扇區 8 - 值區塊雙向模式
  (() => {
    const valueData = createValueBlock(750, 0x20);
    return {
      block: 32, sector: 8, address: 0x20,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：雙向模式 (可遞增和遞減)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 33, sector: 8, address: 0x21,
    data: "44554142494449524543434F4E54524F",
    type: 'data',
    description: "資料區塊：雙向控制模式"
  },
  {
    block: 34, sector: 8, address: 0x22,
    data: "56414C5545424C4F434B4D495848454D",
    type: 'data',
    description: "資料區塊：雙向控制模式"
  },
  {
    block: 35, sector: 8, address: 0x23,
    data: "212223242526C87CF8262728292A2B",
    type: 'trailer',
    description: "扇區尾塊：值區塊雙向模式 (存取位元: C87CF8)",
    keyA: "212223242526",
    keyB: "262728292A2B",
    accessBits: "C87CF8"
  },
  // 扇區 9 - 金鑰 B 嚴格模式
  {
    block: 36, sector: 9, address: 0x24,
    data: "4B45594253545249435441434345533",
    type: 'data',
    description: "資料區塊：金鑰 B 嚴格模式"
  },
  {
    block: 37, sector: 9, address: 0x25,
    data: "4F4E4C594B45594243414E41434345533",
    type: 'data',
    description: "資料區塊：金鑰 B 嚴格模式"
  },
  {
    block: 38, sector: 9, address: 0x26,
    data: "535452494354434F4E54524F4C4D4F44",
    type: 'data',
    description: "資料區塊：金鑰 B 嚴格模式"
  },
  {
    block: 39, sector: 9, address: 0x27,
    data: "313233343536FF7F07363738393A3B",
    type: 'trailer',
    description: "扇區尾塊：金鑰 B 嚴格模式 (存取位元: FF7F07)",
    keyA: "313233343536",
    keyB: "363738393A3B",
    accessBits: "FF7F07"
  },
  // 扇區 10 - 值區塊只讀模式
  (() => {
    const valueData = createValueBlock(9999, 0x28);
    return {
      block: 40, sector: 10, address: 0x28,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：只讀模式 (無法修改)",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 41, sector: 10, address: 0x29,
    data: "52454144434F4E4C5956414C5545424C",
    type: 'data',
    description: "資料區塊：只讀模式"
  },
  {
    block: 42, sector: 10, address: 0x2A,
    data: "50524F54454354454456414C554553",
    type: 'data',
    description: "資料區塊：只讀模式"
  },
  {
    block: 43, sector: 10, address: 0x2B,
    data: "414243444546DF7CF8464748494A4B",
    type: 'trailer',
    description: "扇區尾塊：值區塊只讀模式 (存取位元: DF7CF8)",
    keyA: "414243444546",
    keyB: "464748494A4B",
    accessBits: "DF7CF8"
  },
  // 扇區 11 - 尾塊金鑰 A 可寫模式
  {
    block: 44, sector: 11, address: 0x2C,
    data: "4B45594157524954414245434F4E464",
    type: 'data',
    description: "資料區塊：金鑰 A 可寫尾塊"
  },
  {
    block: 45, sector: 11, address: 0x2D,
    data: "545241494C45524B454942594B415554",
    type: 'data',
    description: "資料區塊：金鑰 A 可寫尾塊"
  },
  {
    block: 46, sector: 11, address: 0x2E,
    data: "4D4F444946494142454C434F4E54524F",
    type: 'data',
    description: "資料區塊：金鑰 A 可寫尾塊"
  },
  {
    block: 47, sector: 11, address: 0x2F,
    data: "515253545556088069565758595A5B",
    type: 'trailer',
    description: "扇區尾塊：金鑰 A 可寫模式 (存取位元: 088069)",
    keyA: "515253545556",
    keyB: "565758595A5B",
    accessBits: "088069"
  },
  // 扇區 12 - 值區塊金鑰 B 控制模式
  (() => {
    const valueData = createValueBlock(2500, 0x30);
    return {
      block: 48, sector: 12, address: 0x30,
      data: valueData,
      type: 'value' as const,
      description: "值區塊：金鑰 B 控制模式",
      valueInfo: parseValueBlock(valueData) || undefined
    };
  })(),
  {
    block: 49, sector: 12, address: 0x31,
    data: "4B45594253545249435456414C554543",
    type: 'data',
    description: "資料區塊：金鑰 B 控制"
  },
  {
    block: 50, sector: 12, address: 0x32,
    data: "4F4E4C594B45594243414E4D4F444946",
    type: 'data',
    description: "資料區塊：金鑰 B 控制"
  },
  {
    block: 51, sector: 12, address: 0x33,
    data: "616263646566CF7CF1666768696A6B",
    type: 'trailer',
    description: "扇區尾塊：值區塊金鑰 B 控制 (存取位元: CF7CF1)",
    keyA: "616263646566",
    keyB: "666768696A6B",
    accessBits: "CF7CF1"
  },
  // 扇區 13 - 尾塊雙金鑰控制模式
  {
    block: 52, sector: 13, address: 0x34,
    data: "4455414C4B4559434F4E54524F4C4D4F",
    type: 'data',
    description: "資料區塊：雙金鑰控制"
  },
  {
    block: 53, sector: 13, address: 0x35,
    data: "424F54484B455953434F4E54524F4C4C",
    type: 'data',
    description: "資料區塊：雙金鑰控制"
  },
  {
    block: 54, sector: 13, address: 0x36,
    data: "545241494C45524143434553534249545",
    type: 'data',
    description: "資料區塊：雙金鑰控制"
  },
  {
    block: 55, sector: 13, address: 0x37,
    data: "717273747576080069767778797A7B",
    type: 'trailer',
    description: "扇區尾塊：雙金鑰控制模式 (存取位元: 080069)",
    keyA: "717273747576",
    keyB: "767778797A7B",
    accessBits: "080069"
  },
  // 扇區 14-21 (簡化的預設設定)
  {
    block: 56, sector: 14, address: 0x38,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 57, sector: 14, address: 0x39,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 58, sector: 14, address: 0x3A,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 59, sector: 14, address: 0x3B,
    data: "FFFFFFFFFFFF078069FFFFFFFFFFFF",
    type: 'trailer',
    description: "扇區尾塊：預設設定",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  },
  {
    block: 60, sector: 15, address: 0x3C,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 61, sector: 15, address: 0x3D,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 62, sector: 15, address: 0x3E,
    data: "00000000000000000000000000000000",
    type: 'data',
    description: "資料區塊：預設設定"
  },
  {
    block: 63, sector: 15, address: 0x3F,
    data: "FFFFFFFFFFFF078069FFFFFFFFFFFF",
    type: 'trailer',
    description: "扇區尾塊：預設設定",
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    accessBits: "078069"
  }
];

type HighlightType = 'uid' | 'bcc' | 'sak' | 'atqa' | 'manufacturer_data' | 'key_a' | 'access_bits' | 'key_b' | 'value' | 'value_inverted' | 'address_backup' | 'normal';

const getHighlightColor = (type: HighlightType): string => {
  switch (type) {
    case 'uid': return 'bg-blue-500';
    case 'bcc': return 'bg-cyan-500';
    case 'sak': return 'bg-indigo-500';
    case 'atqa': return 'bg-purple-500';
    case 'manufacturer_data': return 'bg-slate-500';
    case 'key_a': return 'bg-red-500';
    case 'access_bits': return 'bg-yellow-500';
    case 'key_b': return 'bg-orange-500';
    case 'value': return 'bg-green-500';
    case 'value_inverted': return 'bg-green-600';
    case 'address_backup': return 'bg-green-400';
    case 'normal': return 'bg-slate-700';
    default: return 'bg-slate-700';
  }
};

const getHighlightDescription = (type: HighlightType): string => {
  switch (type) {
    case 'uid': return 'UID - 卡片唯一識別碼';
    case 'bcc': return 'BCC - 區塊檢查字元';
    case 'sak': return 'SAK - 選取確認位元組';
    case 'atqa': return 'ATQA - 答詢回應';
    case 'manufacturer_data': return '製造商資料';
    case 'key_a': return '金鑰 A - 用於驗證';
    case 'access_bits': return '存取位元 - 控制讀寫權限';
    case 'key_b': return '金鑰 B - 用於驗證';
    case 'value': return '值資料';
    case 'value_inverted': return '值的反轉備份';
    case 'address_backup': return '地址備份';
    case 'normal': return '一般資料';
    default: return '未知資料類型';
  }
};

const getByteHighlight = (block: MemoryBlock, byteIndex: number): HighlightType => {
  if (block.type === 'manufacturer' && block.block === 0) {
    if (byteIndex >= 0 && byteIndex <= 3) return 'uid';
    if (byteIndex === 4) return 'bcc';
    if (byteIndex === 5) return 'sak';
    if (byteIndex >= 6 && byteIndex <= 7) return 'atqa';
    return 'manufacturer_data';
  }
  
  if (block.type === 'trailer') {
    if (byteIndex >= 0 && byteIndex <= 5) return 'key_a';
    if (byteIndex >= 6 && byteIndex <= 8) return 'access_bits';
    if (byteIndex === 9) return 'normal';
    if (byteIndex >= 10 && byteIndex <= 15) return 'key_b';
  }
  
  if (block.type === 'value') {
    if (byteIndex >= 0 && byteIndex < 4) return 'value';
    if (byteIndex >= 4 && byteIndex < 8) return 'value_inverted';
    if (byteIndex >= 8 && byteIndex < 12) return 'value';
    return 'address_backup';
  }
  
  return 'normal';
};

const getDataGroupRange = (block: MemoryBlock, byteIndex: number): { start: number; end: number; type: HighlightType } => {
  if (block.type === 'manufacturer' && block.block === 0) {
    if (byteIndex >= 0 && byteIndex <= 3) return { start: 0, end: 3, type: 'uid' };
    if (byteIndex === 4) return { start: 4, end: 4, type: 'bcc' };
    if (byteIndex === 5) return { start: 5, end: 5, type: 'sak' };
    if (byteIndex >= 6 && byteIndex <= 7) return { start: 6, end: 7, type: 'atqa' };
    return { start: 8, end: 15, type: 'manufacturer_data' };
  }
  
  if (block.type === 'trailer') {
    if (byteIndex >= 0 && byteIndex <= 5) return { start: 0, end: 5, type: 'key_a' };
    if (byteIndex >= 6 && byteIndex <= 8) return { start: 6, end: 8, type: 'access_bits' };
    if (byteIndex === 9) return { start: 9, end: 9, type: 'normal' };
    if (byteIndex >= 10 && byteIndex <= 15) return { start: 10, end: 15, type: 'key_b' };
  }
  
  if (block.type === 'value') {
    if (byteIndex >= 0 && byteIndex < 4) return { start: 0, end: 3, type: 'value' };
    if (byteIndex >= 4 && byteIndex < 8) return { start: 4, end: 7, type: 'value_inverted' };
    if (byteIndex >= 8 && byteIndex < 12) return { start: 8, end: 11, type: 'value_inverted' };
    return { start: 12, end: 15, type: 'address_backup' };
  }
  
  return { start: 0, end: 15, type: 'normal' };
};

// 真正的存取位元位元級解析（按照 Mifare Classic 規範）
const parseAccessBitsByBlock = (accessBits: string) => {
  // 將hex字符串轉換為二進制
  const hex = accessBits.padStart(6, '0');
  let binary = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    binary += byte.toString(2).padStart(8, '0');
  }
  
  // 提取每個區塊的C1, C2, C3位元
  // 格式：C13 C23 C33 | C12 C22 C32 | C11 C21 C31 | C10 C20 C30
  const extractBlockBits = (blockNum: number) => {
    const c1Index = 4 + blockNum;    // C1位元位置
    const c2Index = 12 + blockNum;   // C2位元位置  
    const c3Index = 20 + blockNum;   // C3位元位置
    
    const c1 = parseInt(binary[c1Index] || '0');
    const c2 = parseInt(binary[c2Index] || '0');
    const c3 = parseInt(binary[c3Index] || '0');
    
    return { c1, c2, c3, value: c1 * 4 + c2 * 2 + c3 };
  };
  
  // 根據C1C2C3值確定權限
  const getPermissionsByBits = (c1: number, c2: number, c3: number, isTrailer: boolean = false) => {
    const value = c1 * 4 + c2 * 2 + c3;
    
    if (isTrailer) {
      // 扇區尾塊權限表
      switch (value) {
        case 0: // 000
          return { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' };
        case 1: // 001
          return { readA: 'A', writeA: 'A', readAccessBits: 'A', writeAccessBits: 'A', readB: 'A', writeB: 'A' };
        case 2: // 010
          return { readA: '禁止', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' };
        case 3: // 011
          return { readA: 'A', writeA: 'A', readAccessBits: 'A', writeAccessBits: 'A', readB: '禁止', writeB: 'A' };
        case 4: // 100
          return { readA: 'A', writeA: 'A', readAccessBits: 'A', writeAccessBits: 'A', readB: 'A', writeB: 'A' };
        case 5: // 101
          return { readA: '禁止', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' };
        case 6: // 110
          return { readA: 'A', writeA: 'A', readAccessBits: 'A', writeAccessBits: 'A', readB: '禁止', writeB: 'A' };
        case 7: // 111
          return { readA: '禁止', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'A', readB: '禁止', writeB: 'A' };
        default:
          return { readA: '錯誤', writeA: '錯誤', readAccessBits: '錯誤', writeAccessBits: '錯誤', readB: '錯誤', writeB: '錯誤' };
      }
    } else {
      // 資料區塊權限表
      switch (value) {
        case 0: // 000
          return { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B' };
        case 1: // 001
          return { read: 'B', write: 'B', increment: 'B', decrement: 'B' };
        case 2: // 010
          return { read: '公開', write: 'A/B', increment: 'A/B', decrement: 'A/B' };
        case 3: // 011
          return { read: 'B', write: 'A/B', increment: 'A/B', decrement: 'A/B' };
        case 4: // 100
          return { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止' };
        case 5: // 101
          return { read: 'B', write: '禁止', increment: '禁止', decrement: '禁止' };
        case 6: // 110
          return { read: 'B', write: 'B', increment: 'B', decrement: 'B' };
        case 7: // 111
          return { read: '禁止', write: '禁止', increment: '禁止', decrement: '禁止' };
        default:
          return { read: '錯誤', write: '錯誤', increment: '錯誤', decrement: '錯誤' };
      }
    }
  };
  
  // 解析每個區塊
  const block0Bits = extractBlockBits(0);
  const block1Bits = extractBlockBits(1);
  const block2Bits = extractBlockBits(2);
  const trailerBits = extractBlockBits(3);
  
  return {
    block0: {
      bits: block0Bits,
      permissions: getPermissionsByBits(block0Bits.c1, block0Bits.c2, block0Bits.c3)
    },
    block1: {
      bits: block1Bits,
      permissions: getPermissionsByBits(block1Bits.c1, block1Bits.c2, block1Bits.c3)
    },
    block2: {
      bits: block2Bits,
      permissions: getPermissionsByBits(block2Bits.c1, block2Bits.c2, block2Bits.c3)
    },
    trailer: {
      bits: trailerBits,
      permissions: getPermissionsByBits(trailerBits.c1, trailerBits.c2, trailerBits.c3, true)
    },
    rawBinary: binary,
    isValidFormat: true // 可以添加格式驗證邏輯
  };
};

// 解析存取位元並返回每個區塊的具體權限
const parseBlockPermissions = (accessBits: string) => {
  // 將存取位元轉換為二進位並解析每個區塊的權限
  const getBlockPermissions = (accessBits: string) => {
    // 根據 Mifare Classic 標準解析存取位元
    switch (accessBits) {
      case '078069': // 000
        return {
          block0: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case '787F07': // 010
        return {
          block0: { read: '公開', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: '公開', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: '公開', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'F87887': // 100
        return {
          block0: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block1: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block2: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: '禁止', readB: '禁止', writeB: '禁止' }
        };
      case '877009': // 001
        return {
          block0: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block1: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block2: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case '8F7F08': // 011
        return {
          block0: { read: 'B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'FF7F88': // 101
        return {
          block0: { read: 'B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block1: { read: 'B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block2: { read: 'B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: '禁止', readB: '禁止', writeB: '禁止' }
        };
      case 'FF7F07': // 110
        return {
          block0: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block1: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block2: { read: 'B', write: 'B', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'FFF000': // 111
        return {
          block0: { read: '禁止', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block1: { read: '禁止', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block2: { read: '禁止', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          trailer: { readA: '禁止', writeA: '禁止', readAccessBits: '禁止', writeAccessBits: '禁止', readB: '禁止', writeB: '禁止' }
        };
      
      // 值區塊專用模式
      case 'C078F8': // 000-V (遞增模式)
        return {
          block0: { read: 'A/B', write: '禁止', increment: 'B', decrement: '禁止', transfer: 'B', restore: 'A/B' },
          block1: { read: 'A/B', write: '禁止', increment: 'B', decrement: '禁止', transfer: 'B', restore: 'A/B' },
          block2: { read: 'A/B', write: '禁止', increment: 'B', decrement: '禁止', transfer: 'B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'C17CF1': // 001-V (遞減模式)
        return {
          block0: { read: 'A/B', write: '禁止', increment: '禁止', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'A/B', write: '禁止', increment: '禁止', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'A/B', write: '禁止', increment: '禁止', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'C87CF8': // 010-V (雙向模式)
        return {
          block0: { read: 'A/B', write: '禁止', increment: 'B', decrement: 'A', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'A/B', write: '禁止', increment: 'B', decrement: 'A', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'A/B', write: '禁止', increment: 'B', decrement: 'A', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'CF7CF1': // 011-V (金鑰 B 控制)
        return {
          block0: { read: 'B', write: '禁止', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block1: { read: 'B', write: '禁止', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          block2: { read: 'B', write: '禁止', increment: 'B', decrement: 'B', transfer: 'B', restore: 'B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'B', readB: '禁止', writeB: 'B' }
        };
      case 'DF7CF8': // 100-V (值區塊只讀)
        return {
          block0: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block1: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          block2: { read: 'A/B', write: '禁止', increment: '禁止', decrement: '禁止', transfer: '禁止', restore: '禁止' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: '禁止', readB: '禁止', writeB: '禁止' }
        };

      // 扇區尾塊專用模式
      case '088069': // 001-T (金鑰 A 可寫)
        return {
          block0: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: 'A', readAccessBits: 'A', writeAccessBits: 'A/B', readB: 'A', writeB: 'A/B' }
        };
      case '080069': // 011-T (雙金鑰控制)
        return {
          block0: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block1: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          block2: { read: 'A/B', write: 'A/B', increment: 'A/B', decrement: 'A/B', transfer: 'A/B', restore: 'A/B' },
          trailer: { readA: 'A', writeA: '禁止', readAccessBits: 'A', writeAccessBits: 'A/B', readB: '禁止', writeB: 'A/B' }
        };

      default:
        return {
          block0: { read: '未知', write: '未知', increment: '未知', decrement: '未知', transfer: '未知', restore: '未知' },
          block1: { read: '未知', write: '未知', increment: '未知', decrement: '未知', transfer: '未知', restore: '未知' },
          block2: { read: '未知', write: '未知', increment: '未知', decrement: '未知', transfer: '未知', restore: '未知' },
          trailer: { readA: '未知', writeA: '未知', readAccessBits: '未知', writeAccessBits: '未知', readB: '未知', writeB: '未知' }
        };
    }
  };

  return getBlockPermissions(accessBits);
};

// 解析存取位元
const parseAccessBits = (accessBits: string) => {
  const getAccessModeDescription = (accessBits: string) => {
    switch (accessBits) {
      // 標準模式
      case '078069':
        return {
          mode: '預設模式 (000)',
          description: '所有區塊可用金鑰 A 或 B 讀寫',
          color: 'text-green-400',
          bgColor: 'bg-green-900/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀存取位元，金鑰 B 可寫'
        };
      case '787F07':
        return {
          mode: '公開讀取模式 (010)',
          description: '任何人可讀取，需金鑰寫入',
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/30',
          dataBlocks: '公開可讀，金鑰 A/B 可寫',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'F87887':
        return {
          mode: '只讀模式 (100)',
          description: '只能讀取，永遠無法寫入',
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          dataBlocks: '金鑰 A/B 可讀，永不可寫',
          trailer: '金鑰 A 可讀，永不可寫存取位元'
        };
      case '877009':
        return {
          mode: '金鑰 B 讀寫模式 (001)',
          description: '需要金鑰 B 才能讀寫',
          color: 'text-purple-400',
          bgColor: 'bg-purple-900/30',
          dataBlocks: '金鑰 B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case '8F7F08':
        return {
          mode: '金鑰 B 讀取模式 (011)',
          description: '金鑰 B 可讀，金鑰 A/B 可寫',
          color: 'text-purple-300',
          bgColor: 'bg-purple-800/30',
          dataBlocks: '金鑰 B 可讀，金鑰 A/B 可寫',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'FF7F88':
        return {
          mode: '金鑰 B 只讀模式 (101)',
          description: '僅金鑰 B 可讀，無法寫入',
          color: 'text-purple-500',
          bgColor: 'bg-purple-700/30',
          dataBlocks: '金鑰 B 可讀，永不可寫',
          trailer: '金鑰 A 可讀，永不可寫存取位元'
        };
      case 'FF7F07':
        return {
          mode: '金鑰 B 嚴格模式 (110)',
          description: '僅金鑰 B 可讀寫',
          color: 'text-purple-600',
          bgColor: 'bg-purple-600/30',
          dataBlocks: '僅金鑰 B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'FFF000':
        return {
          mode: '禁止存取模式 (111)',
          description: '完全禁止存取',
          color: 'text-gray-400',
          bgColor: 'bg-gray-900/30',
          dataBlocks: '完全禁止存取',
          trailer: '完全禁止存取'
        };
      
      // 值區塊專用模式
      case 'C078F8':
        return {
          mode: '值區塊遞增模式 (000-V)',
          description: '值區塊只能遞增，不能遞減',
          color: 'text-orange-400',
          bgColor: 'bg-orange-900/30',
          dataBlocks: '金鑰 A/B 可讀，金鑰 B 可遞增',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'C17CF1':
        return {
          mode: '值區塊遞減模式 (001-V)',
          description: '值區塊只能遞減，不能遞增',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/30',
          dataBlocks: '金鑰 A/B 可讀，金鑰 A/B 可遞減',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'C87CF8':
        return {
          mode: '值區塊雙向模式 (010-V)',
          description: '值區塊可遞增和遞減',
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-900/30',
          dataBlocks: '金鑰 A/B 可讀，金鑰 A 可遞減，金鑰 B 可遞增',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'CF7CF1':
        return {
          mode: '值區塊金鑰 B 控制 (011-V)',
          description: '僅金鑰 B 可操作值區塊',
          color: 'text-indigo-400',
          bgColor: 'bg-indigo-900/30',
          dataBlocks: '金鑰 B 可讀，金鑰 B 可遞增/遞減',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'DF7CF8':
        return {
          mode: '值區塊只讀模式 (100-V)',
          description: '值區塊只能讀取，無法修改',
          color: 'text-pink-400',
          bgColor: 'bg-pink-900/30',
          dataBlocks: '金鑰 A/B 可讀，永不可寫',
          trailer: '金鑰 A 可讀，永不可寫存取位元'
        };
      case 'EF7CF1':
        return {
          mode: '值區塊金鑰 B 只讀 (101-V)',
          description: '僅金鑰 B 可讀取值區塊',
          color: 'text-rose-400',
          bgColor: 'bg-rose-900/30',
          dataBlocks: '金鑰 B 可讀，永不可寫',
          trailer: '金鑰 A 可讀，永不可寫存取位元'
        };
      case 'FF7CF8':
        return {
          mode: '值區塊嚴格控制 (110-V)',
          description: '僅金鑰 B 可讀寫值區塊',
          color: 'text-violet-400',
          bgColor: 'bg-violet-900/30',
          dataBlocks: '僅金鑰 B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 B 可寫存取位元'
        };
      case 'FFF001':
        return {
          mode: '值區塊禁止模式 (111-V)',
          description: '值區塊完全禁止存取',
          color: 'text-stone-400',
          bgColor: 'bg-stone-900/30',
          dataBlocks: '完全禁止存取',
          trailer: '完全禁止存取'
        };

      // 扇區尾塊專用模式
      case '088069':
        return {
          mode: '尾塊金鑰 A 可寫 (001-T)',
          description: '金鑰 A 可讀寫存取位元',
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-900/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀寫存取位元，金鑰 B 可寫'
        };
      case '008069':
        return {
          mode: '尾塊禁寫金鑰 A (010-T)',
          description: '金鑰 A 不可讀，金鑰 B 可寫存取位元',
          color: 'text-teal-400',
          bgColor: 'bg-teal-900/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 不可讀，金鑰 B 可寫存取位元'
        };
      case '080069':
        return {
          mode: '尾塊雙金鑰控制 (011-T)',
          description: '金鑰 A 可讀，金鑰 A/B 可寫存取位元',
          color: 'text-lime-400',
          bgColor: 'bg-lime-900/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 A/B 可寫存取位元'
        };
      case '000069':
        return {
          mode: '尾塊完全開放 (100-T)',
          description: '金鑰 A 可讀，金鑰 A/B 可寫存取位元和金鑰',
          color: 'text-amber-400',
          bgColor: 'bg-amber-900/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 A/B 可寫所有內容'
        };
      case '008009':
        return {
          mode: '尾塊嚴格模式 (101-T)',
          description: '金鑰 A 不可讀，金鑰 B 可寫存取位元',
          color: 'text-red-500',
          bgColor: 'bg-red-800/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 不可讀，金鑰 B 可寫存取位元'
        };
      case '080009':
        return {
          mode: '尾塊混合控制 (110-T)',
          description: '金鑰 A 可讀，金鑰 A/B 可寫',
          color: 'text-orange-500',
          bgColor: 'bg-orange-800/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀，金鑰 A/B 可寫存取位元'
        };
      case '000009':
        return {
          mode: '尾塊危險模式 (111-T)',
          description: '金鑰 A 可讀寫所有內容 (危險)',
          color: 'text-red-600',
          bgColor: 'bg-red-700/30',
          dataBlocks: '金鑰 A/B 可讀寫',
          trailer: '金鑰 A 可讀寫所有內容 (包括金鑰)'
        };

      default:
        return {
          mode: '自定義模式',
          description: '未知或自定義的存取控制設定',
          color: 'text-slate-400',
          bgColor: 'bg-slate-900/30',
          dataBlocks: '未知權限配置',
          trailer: '未知權限配置'
        };
    }
  };

  return getAccessModeDescription(accessBits);
};

// 獲取扇區的 Trailer Block 資訊
const getSectorTrailerInfo = (sectorNumber: number, memoryData: MemoryBlock[]) => {
  const trailerBlock = memoryData.find(block => 
    block.sector === sectorNumber && block.type === 'trailer'
  );
  return trailerBlock;
};

const HexEditor = ({ 
  data, 
  selectedBlock, 
  onBlockSelect,
  selectedSector 
}: { 
  data: MemoryBlock[]; 
  selectedBlock: number | null;
  onBlockSelect: (block: number) => void;
  selectedSector: number | null;
}) => {
  const [hoveredGroup, setHoveredGroup] = useState<{blockIndex: number, start: number, end: number} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 當選擇的扇區改變時，自動滾動到該扇區
  useEffect(() => {
    if (selectedSector !== null && scrollContainerRef.current) {
      const sectorElement = scrollContainerRef.current.querySelector(`[data-sector="${selectedSector}"]`);
      if (sectorElement) {
        sectorElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }
  }, [selectedSector]);

  return (
    <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm h-full flex flex-col">
      {/* Header - 固定在頂部 */}
      <div className="grid mb-2 sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm py-2 flex-shrink-0" style={{ gridTemplateColumns: '64px 1fr' }}>
        <div className="text-slate-400 text-xs flex items-center justify-center">Addr</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
          {[...Array(16)].map((_, i) => (
            <div key={i} className="text-slate-400 text-xs text-center p-0.5">
              {i.toString(16).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      
      {/* 滾動容器 - 只有這個區域會滾動 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 min-h-0">
        {data.map((block, blockIndex) => {
          const isSelected = selectedBlock === blockIndex;
          const isTrailer = block.type === 'trailer';
          const isSectorStart = block.block % 4 === 0; // 每個扇區的第一個區塊
          
          // 顯示完整資料，包括 trailer block 的金鑰
          const displayBytes = block.data.match(/.{2}/g) || [];
          
          return (
            <div key={blockIndex}>
              {/* 扇區標識 */}
              {isSectorStart && (
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-2" data-sector={block.sector}>
                  <div className="flex-1 h-px bg-slate-600"></div>
                  <span className="px-2 bg-slate-800 rounded">扇區 {block.sector}</span>
                  <div className="flex-1 h-px bg-slate-600"></div>
                </div>
              )}
              
              <motion.div
                className={`grid ${isTrailer ? 'mb-2' : ''}`}
                style={{ gridTemplateColumns: '64px 1fr' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: blockIndex * 0.005 }}
              >
                {/* Address */}
                <div className="text-slate-400 text-xs flex items-center justify-center px-2 py-0.5 border-r border-slate-600 bg-slate-800/50 w-16">
                  0x{block.address.toString(16).toUpperCase().padStart(2, '0')}
                </div>
                
                {/* Data bytes with group-level borders */}
                <div className="grid gap-0 relative" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
                  {[...Array(16)].map((_, byteIndex) => {
                    const byte = displayBytes[byteIndex] || '00';
                    const highlightType = getByteHighlight(block, byteIndex);
                    const highlightColor = getHighlightColor(highlightType);
                    const groupRange = getDataGroupRange(block, byteIndex);
                    
                    const isInHoveredGroup = hoveredGroup && 
                      hoveredGroup.blockIndex === blockIndex &&
                      byteIndex >= hoveredGroup.start && 
                      byteIndex <= hoveredGroup.end;
                    
                    return (
                      <motion.button
                        key={byteIndex}
                        onClick={() => onBlockSelect(blockIndex)}
                        onMouseEnter={() => setHoveredGroup({
                          blockIndex,
                          start: groupRange.start,
                          end: groupRange.end
                        })}
                        onMouseLeave={() => setHoveredGroup(null)}
                        className={`
                          relative h-5 text-xs flex items-center justify-center transition-all font-bold text-white
                          ${isSelected 
                            ? `${highlightColor}` 
                            : `${highlightColor}`
                          }
                          ${isInHoveredGroup ? 'z-10 shadow-lg scale-110' : ''}
                        `}
                        title={`位元組 ${byteIndex}: ${byte} - ${getHighlightDescription(highlightType)}`}
                      >
                        {byte}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BlockBasicInfo = ({ 
  block
}: { 
  block: MemoryBlock | null;
}) => {
  if (!block) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 text-center text-slate-400 text-sm">
        選擇一個記憶體區塊查看詳細資訊
      </div>
    );
  }

  return (
    <motion.div
      key={block.block}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-lg p-3 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded ${
          block.type === 'manufacturer' ? 'bg-blue-600' :
          block.type === 'data' ? 'bg-slate-600' :
          block.type === 'value' ? 'bg-green-600' :
          'bg-red-600'
        }`}></div>
        <h3 className="text-sm font-bold">
          區塊 {block.block} (0x{block.address.toString(16).toUpperCase().padStart(2, '0')})
        </h3>
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <h4 className="font-bold text-slate-300 mb-1">基本資訊</h4>
          <div className="space-y-0.5">
            <div>扇區: {block.sector}</div>
            <div>類型: {
              block.type === 'manufacturer' ? '製造商' :
              block.type === 'data' ? '資料' :
              block.type === 'value' ? '值' :
              '尾塊'
            }</div>
            <div>地址: 0x{block.address.toString(16).toUpperCase().padStart(2, '0')}</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-slate-300 mb-1">原始資料</h4>
          <div className="bg-slate-900 p-2 rounded font-mono text-xs break-all">
            {block.data}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const BlockStructureDetails = ({ 
  block,
  selectedSector,
  memoryData
}: { 
  block: MemoryBlock | null;
  selectedSector: number | null;
  memoryData: MemoryBlock[];
}) => {
  const selectedTrailerInfo = selectedSector !== null ? getSectorTrailerInfo(selectedSector, memoryData) : null;
  
  if (!block) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-3 text-center text-slate-400 text-sm">
        選擇區塊查看資料結構
      </div>
    );
  }

  return (
    <motion.div
      key={`structure-${block.block}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-lg p-3 space-y-3"
    >
      <h3 className="text-sm font-bold">資料結構詳細</h3>
      
      {/* 顯示選中扇區的金鑰資訊 */}
      {selectedTrailerInfo && (
        <div className="p-3 bg-slate-900/50 rounded mb-3">
          <h5 className="font-bold text-slate-300 mb-2 text-xs">扇區 {selectedSector} 驗證資訊</h5>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-red-400 font-bold">金鑰 A:</span>
              <span className="font-mono">{selectedTrailerInfo.keyA}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-400 font-bold">存取位元:</span>
              <span className="font-mono">{selectedTrailerInfo.accessBits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-orange-400 font-bold">金鑰 B:</span>
              <span className="font-mono">{selectedTrailerInfo.keyB}</span>
            </div>
            {(() => {
              const accessInfo = parseAccessBits(selectedTrailerInfo.accessBits || '');
              return (
                <div className="mt-2 space-y-2">
                  <div className={`p-2 rounded ${accessInfo.bgColor}`}>
                    <div className={`font-bold ${accessInfo.color} text-xs`}>
                      存取模式: {accessInfo.mode}
                    </div>
                    <div className="text-slate-300 text-xs mt-1">
                      {accessInfo.description}
                    </div>
                    
                    {/* 精確的位元級分析 */}
                    <div className="mt-2 p-2 bg-slate-900/50 rounded border border-cyan-600">
                      <div className="text-cyan-300 text-xs font-semibold mb-2">🔬 精確位元分析</div>
                      {(() => {
                        const bitAnalysis = parseAccessBitsByBlock(selectedTrailerInfo.accessBits || '');
                        return (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-4 gap-1">
                              {[0, 1, 2, 3].map(blockNum => {
                                const blockKey = blockNum === 3 ? 'trailer' : `block${blockNum}` as 'block0' | 'block1' | 'block2';
                                const blockData = bitAnalysis[blockKey];
                                return (
                                  <div key={blockNum} className="bg-slate-800/50 p-1 rounded text-center">
                                    <div className="text-slate-300 font-semibold">
                                      {blockNum === 3 ? '尾塊' : `區塊${blockNum}`}
                                    </div>
                                    <div className="text-cyan-400 font-mono">
                                      {blockData.bits.c1}{blockData.bits.c2}{blockData.bits.c3}
                                    </div>
                                    <div className="text-slate-400">
                                      ({blockData.bits.value})
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-slate-400 text-xs">
                              每個區塊的 C1C2C3 位元組合決定其獨立的存取權限
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* 詳細區塊權限 */}
                  <div className="bg-slate-800/50 p-2 rounded">
                    <div className="font-bold text-slate-200 mb-2 text-xs">當前區塊存取權限（精確分析）</div>
                    {(() => {
                      const bitAnalysis = parseAccessBitsByBlock(selectedTrailerInfo.accessBits || '');
                      const blockInSector = block.block % 4;
                      let currentBlockData;
                      let blockLabel = "";
                      
                      if (blockInSector === 0) {
                        currentBlockData = bitAnalysis.block0;
                        blockLabel = `區塊 ${block.block}`;
                      } else if (blockInSector === 1) {
                        currentBlockData = bitAnalysis.block1;
                        blockLabel = `區塊 ${block.block}`;
                      } else if (blockInSector === 2) {
                        currentBlockData = bitAnalysis.block2;
                        blockLabel = `區塊 ${block.block}`;
                      } else {
                        // 扇區尾塊
                        currentBlockData = bitAnalysis.trailer;
                        blockLabel = `區塊 ${block.block}`;
                        return (
                          <div className="border border-purple-600 rounded p-2">
                            <div className="font-semibold text-purple-300 mb-1">{blockLabel} (扇區尾塊)</div>
                            <div className="mb-2 text-xs">
                              <span className="text-cyan-300">存取位元：</span>
                              <span className="font-mono text-cyan-400">
                                C1C2C3 = {currentBlockData.bits.c1}{currentBlockData.bits.c2}{currentBlockData.bits.c3} ({currentBlockData.bits.value})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-red-300">讀金鑰A:</span>
                                <span className={`font-mono ${currentBlockData.permissions.readA === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.readA}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-300">寫金鑰A:</span>
                                <span className={`font-mono ${currentBlockData.permissions.writeA === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.writeA}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-yellow-300">讀存取位元:</span>
                                <span className={`font-mono ${currentBlockData.permissions.readAccessBits === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.readAccessBits}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-yellow-300">寫存取位元:</span>
                                <span className={`font-mono ${currentBlockData.permissions.writeAccessBits === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.writeAccessBits}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-orange-300">讀金鑰B:</span>
                                <span className={`font-mono ${currentBlockData.permissions.readB === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.readB}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-orange-300">寫金鑰B:</span>
                                <span className={`font-mono ${currentBlockData.permissions.writeB === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.writeB}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      if (currentBlockData) {
                        return (
                          <div className="border border-slate-600 rounded p-2">
                            <div className="font-semibold text-slate-300 mb-1">{blockLabel}</div>
                            <div className="mb-2 text-xs">
                              <span className="text-cyan-300">存取位元：</span>
                              <span className="font-mono text-cyan-400">
                                C1C2C3 = {currentBlockData.bits.c1}{currentBlockData.bits.c2}{currentBlockData.bits.c3} ({currentBlockData.bits.value})
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-blue-300">讀取:</span>
                                <span className={`font-mono ${currentBlockData.permissions.read === '禁止' ? 'text-red-400' : currentBlockData.permissions.read === '公開' ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.read}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-300">寫入:</span>
                                <span className={`font-mono ${currentBlockData.permissions.write === '禁止' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {currentBlockData.permissions.write}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-300">遞增:</span>
                                <span className={`font-mono ${currentBlockData.permissions.increment === '禁止' ? 'text-red-400' : 'text-green-400'}`}>
                                  {currentBlockData.permissions.increment}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-orange-300">遞減:</span>
                                <span className={`font-mono ${currentBlockData.permissions.decrement === '禁止' ? 'text-red-400' : 'text-orange-400'}`}>
                                  {currentBlockData.permissions.decrement}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* 特殊區塊詳細資訊 */}
      {block.type === 'trailer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-2 text-xs">扇區尾塊結構</h4>
          <div className="space-y-3 text-xs">
            {/* 結構說明 */}
            <div className="bg-slate-800/50 p-3 rounded border border-slate-600">
              <h5 className="font-semibold text-slate-200 mb-2">扇區尾塊組成</h5>
              <div className="space-y-1 text-slate-300">
                <div className="flex justify-between">
                  <span>金鑰 A (Bytes 0-5):</span>
                  <span className="font-mono text-red-300">6 位元組</span>
                </div>
                <div className="flex justify-between">
                  <span>存取位元 (Bytes 6-9):</span>
                  <span className="font-mono text-yellow-300">4 位元組</span>
                </div>
                <div className="flex justify-between">
                  <span>金鑰 B (Bytes 10-15):</span>
                  <span className="font-mono text-orange-300">6 位元組</span>
                </div>
              </div>
            </div>

            {/* 存取位元說明 */}
            <div className="bg-slate-800/50 p-3 rounded border border-yellow-600">
              <h5 className="font-semibold text-yellow-200 mb-2">存取位元控制</h5>
              <div className="space-y-1 text-slate-300 text-xs">
                <p>• 每個扇區的 4 個區塊各有獨立的 3 位元控制 (C1C2C3)</p>
                <p>• 位元組 6: C1₃C1₂C1₁C1₀ (反向)</p>
                <p>• 位元組 7: C2₃C2₂C2₁C2₀ (反向)</p>
                <p>• 位元組 8: C3₃C3₂C3₁C3₀ (反向)</p>
                <p>• 位元組 9: 自由運用</p>
              </div>
            </div>

            {/* 金鑰說明 */}
            <div className="bg-slate-800/50 p-3 rounded border border-slate-600">
              <h5 className="font-semibold text-slate-200 mb-2">存取金鑰</h5>
              <div className="space-y-1 text-slate-300 text-xs">
                <div><span className="text-red-300">金鑰 A:</span> 主要驗證金鑰，通常用於一般存取</div>
                <div><span className="text-orange-300">金鑰 B:</span> 次要驗證金鑰，可用於特殊權限或管理</div>
                <div className="text-yellow-300 mt-2">📝 金鑰永遠無法被直接讀取，只能用於驗證</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'value' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">值區塊結構</h4>
          {(() => {
            const valueInfo = block.valueInfo;
            if (!valueInfo) {
              return (
                <div className="bg-red-900/30 p-2 rounded text-xs">
                  <div className="font-bold text-red-400 mb-1">格式錯誤</div>
                  <div className="text-slate-400">無法解析值區塊格式</div>
                </div>
              );
            }
            
            return (
              <div className="space-y-1 text-xs">
                <div className={`p-2 rounded ${valueInfo.isValid ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <div className={`font-bold mb-1 ${valueInfo.isValid ? 'text-green-400' : 'text-red-400'}`}>
                    數值: {valueInfo.value} (0x{valueInfo.value.toString(16).toUpperCase().padStart(8, '0')})
                  </div>
                  <div className="text-slate-400">
                    {valueInfo.isValid ? '格式驗證通過' : '格式驗證失敗'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-1">
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.valueInverted ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">值反轉</div>
                    <div>0x{valueInfo.valueInverted.toString(16).toUpperCase().padStart(8, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.valueBackup ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">值備份</div>
                    <div>0x{valueInfo.valueBackup.toString(16).toUpperCase().padStart(8, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.addrInverted ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">地址</div>
                    <div>0x{valueInfo.addr.toString(16).toUpperCase().padStart(2, '0')} / 0x{valueInfo.addrInverted.toString(16).toUpperCase().padStart(2, '0')}</div>
                  </div>
                  <div className={`p-1 rounded text-xs ${valueInfo.validationErrors.addrBackup ? 'bg-red-900/20' : 'bg-slate-900/30'}`}>
                    <div className="font-bold">地址備份</div>
                    <div>0x{valueInfo.addrBackup.toString(16).toUpperCase().padStart(2, '0')} / 0x{valueInfo.addrInvertedBackup.toString(16).toUpperCase().padStart(2, '0')}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {block.type === 'manufacturer' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">製造商資料結構</h4>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="bg-blue-900/30 p-2 rounded">
              <div className="font-bold text-blue-400 mb-1">UID (0-3 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(0, 8).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
            <div className="bg-cyan-900/30 p-2 rounded">
              <div className="font-bold text-cyan-400 mb-1">BCC (4 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(8, 10).toUpperCase()}
              </div>
            </div>
            <div className="bg-indigo-900/30 p-2 rounded">
              <div className="font-bold text-indigo-400 mb-1">SAK (5 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(10, 12).toUpperCase()}
              </div>
            </div>
            <div className="bg-purple-900/30 p-2 rounded">
              <div className="font-bold text-purple-400 mb-1">ATQA (6-7 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(12, 16).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
            <div className="bg-slate-900/30 p-2 rounded">
              <div className="font-bold text-slate-400 mb-1">製造商資料 (8-15 位元組)</div>
              <div className="font-mono text-xs">
                {block.data.substring(16, 32).match(/.{2}/g)?.join(' ').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'data' && (
        <div>
          <h4 className="font-bold text-slate-300 mb-1 text-xs">資料區塊</h4>
          <div className="bg-slate-900/30 p-2 rounded text-xs mb-2">
            <div className="text-slate-400">此區塊用於儲存應用程式資料。</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const MemoryMap = ({ 
  onSectorSelect, 
  selectedSector
}: { 
  onSectorSelect: (sector: number) => void;
  selectedSector: number | null;
}) => {
  const getSectorColor = (sector: number) => {
    // 簡化顏色，只區分特殊扇區
    if (sector === 0) return 'bg-blue-600'; // 製造商區塊
    if (sector === selectedSector) return 'bg-purple-600'; // 選中的扇區
    return 'bg-slate-600'; // 一般扇區
  };

  const getSectorDescription = (sector: number) => {
    if (sector === 0) return 'UID';
    return `區塊 ${sector * 4}-${sector * 4 + 3}`;
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <h4 className="font-bold mb-2 text-sm">記憶體配置圖</h4>
      <div className="grid grid-cols-4 gap-1">
        {[...Array(16)].map((_, sector) => (
          <motion.button
            key={sector}
            onClick={() => onSectorSelect(sector)}
            className={`
              p-2 rounded text-xs font-medium transition-all text-white
              ${selectedSector === sector 
                ? 'ring-2 ring-purple-400 shadow-lg' 
                : 'hover:shadow-md'
              }
              ${getSectorColor(sector)}
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div>扇區{sector}</div>
            <div className="text-xs opacity-90">
              {getSectorDescription(sector)}
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="mt-3 space-y-1">
        <div className="text-xs text-slate-400">
          總容量: 1024 bytes (64 區塊 × 16 位元組)
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
            <span className="text-slate-400">製造商區塊</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-600 rounded-sm"></div>
            <span className="text-slate-400">已選擇</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-600 rounded-sm"></div>
            <span className="text-slate-400">一般扇區</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MemoryPage() {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(0);
  const [selectedSector, setSelectedSector] = useState<number | null>(0);

  const handleSectorSelect = (sector: number) => {
    setSelectedSector(sector);
    // 自動選擇該扇區的第一個區塊
    const firstBlockInSector = memoryData.findIndex(block => block.sector === sector);
    if (firstBlockInSector !== -1) {
      setSelectedBlock(firstBlockInSector);
    }
  };

  const selectedBlockData = selectedBlock !== null ? memoryData[selectedBlock] : null;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col overflow-hidden">
      <div className="container mx-auto px-4 py-4 flex flex-col flex-1 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mifare Classic 記憶體分布
            </h1>
          </div>
        </motion.div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Hex Editor */}
          <div className="flex-shrink-0 flex flex-col min-h-0" style={{ width: '700px' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 mb-4 flex-1 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-lg font-bold">十六進制編輯器視圖</h3>
              </div>
              
              {/* 詳細圖例 - 固定不滾動 */}
              <div className="mb-3 p-2 bg-slate-900/50 rounded-lg flex-shrink-0">
                <h4 className="text-xs font-bold mb-1">資料類型圖例</h4>
                <div className="grid grid-cols-5 lg:grid-cols-10 gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                    <span>UID</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-cyan-500 rounded-sm"></div>
                    <span>BCC</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-indigo-500 rounded-sm"></div>
                    <span>SAK</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-sm"></div>
                    <span>ATQA</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
                    <span>金鑰A</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-sm"></div>
                    <span>存取位元</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-sm"></div>
                    <span>金鑰B</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                    <span>值資料</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-500 rounded-sm"></div>
                    <span>製造商</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-700 rounded-sm"></div>
                    <span>一般</span>
                  </div>
                </div>
              </div>
              
              {/* HexEditor 容器 - 可滾動 */}
              <div className="flex-1 flex flex-col min-h-0">
                <HexEditor 
                  data={memoryData}
                  selectedBlock={selectedBlock}
                  onBlockSelect={setSelectedBlock}
                  selectedSector={selectedSector}
                />
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 - 左右分欄 */}
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-4 min-h-0">
            {/* 左欄 */}
            <div className="space-y-3 flex flex-col min-h-0">
              {/* 記憶體配置圖 */}
              <MemoryMap 
                onSectorSelect={handleSectorSelect}
                selectedSector={selectedSector}
              />

              {/* 區塊基本資料 */}
              <div className="flex-1 min-h-0">
                <BlockBasicInfo 
                  block={selectedBlockData}
                />
              </div>
            </div>

            {/* 右欄 */}
            <div className="space-y-3 flex flex-col min-h-0">
              {/* 區塊詳細結構 */}
              <div className="flex-1 min-h-0">
                <BlockStructureDetails 
                  block={selectedBlockData}
                  selectedSector={selectedSector}
                  memoryData={memoryData}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
