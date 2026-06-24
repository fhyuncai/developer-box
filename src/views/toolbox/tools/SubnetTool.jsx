import { useMemo, useState } from 'react';
import { Card, Flex, Input, Space, Typography } from 'antd';

function parseIPv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const oct = Number(part);
    if (oct < 0 || oct > 255) return null;
    num = (num << 8) | oct;
  }
  return num >>> 0;
}

function ipv4ToString(num) {
  return [24, 16, 8, 0].map((shift) => (num >>> shift) & 255).join('.');
}

function parseIPv6(ip) {
  if (!ip.includes(':')) return null;
  if (ip.includes(':::')) return null;

  const [leftRaw, rightRaw = ''] = ip.split('::');
  const left = leftRaw ? leftRaw.split(':').filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(':').filter(Boolean) : [];

  if (ip.includes('::')) {
    if (left.length + right.length > 8) return null;
  } else if (left.length !== 8) {
    return null;
  }

  const missing = 8 - (left.length + right.length);
  const groups = ip.includes('::')
    ? [...left, ...Array(missing).fill('0'), ...right]
    : left;

  if (groups.length !== 8) return null;

  let out = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    out = (out << 16n) + BigInt(parseInt(g, 16));
  }
  return out;
}

function ipv6ToExpanded(num) {
  const groups = [];
  let current = num;
  for (let i = 0; i < 8; i += 1) {
    const shift = BigInt((7 - i) * 16);
    const v = Number((current >> shift) & 0xffffn);
    groups.push(v.toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

function ipv6ToCompressed(num) {
  const groups = ipv6ToExpanded(num).split(':').map((g) => g.replace(/^0+/, '') || '0');
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i <= groups.length; i += 1) {
    if (i < groups.length && groups[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen += 1;
    } else {
      if (curLen > bestLen && curLen >= 2) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestStart === -1) return groups.join(':');

  const left = groups.slice(0, bestStart).join(':');
  const right = groups.slice(bestStart + bestLen).join(':');
  if (!left && !right) return '::';
  if (!left) return `::${right}`;
  if (!right) return `${left}::`;
  return `${left}::${right}`;
}

function formatBigInt(value) {
  const str = value.toString();
  if (str.length <= 18) return str;
  return `${str.slice(0, 6)}...${str.slice(-6)} (${str.length} 位)`;
}

function calcSubnet(input) {
  const raw = input.trim();
  if (!raw) return { error: '请输入 IP 地址' };

  const hasMask = raw.includes('/');
  const [ipPart, maskPart] = raw.split('/');
  const effectiveMask = hasMask && maskPart.trim() !== '';
  const isV6 = ipPart.includes(':');
  const family = isV6 ? 'IPv6' : 'IPv4';

  if (!isV6) {
    const ipNum = parseIPv4(ipPart);
    if (ipNum === null) return { error: 'IPv4 地址格式无效' };

    const prefix = effectiveMask ? Number(maskPart) : 32;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return { error: 'IPv4 掩码范围应为 0-32' };
    }

    const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
    const network = ipNum & mask;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const hosts = prefix >= 31 ? 0 : Math.max(0, broadcast - network - 1);
    const first = prefix >= 31 ? network : network + 1;
    const last = prefix >= 31 ? broadcast : broadcast - 1;

    return {
      family,
      ip: `${ipPart}/${prefix}`,
      network: ipv4ToString(network),
      netmask: ipv4ToString(mask),
      broadcast: ipv4ToString(broadcast),
      firstHost: ipv4ToString(first >>> 0),
      lastHost: ipv4ToString(last >>> 0),
      hosts: String(hosts),
    };
  }

  const ipNum = parseIPv6(ipPart);
  if (ipNum === null) return { error: 'IPv6 地址格式无效' };

  const prefix = effectiveMask ? Number(maskPart) : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) {
    return { error: 'IPv6 掩码范围应为 0-128' };
  }

  const allOnes = (1n << 128n) - 1n;
  const mask = prefix === 0 ? 0n : ((allOnes << BigInt(128 - prefix)) & allOnes);
  const network = ipNum & mask;
  const hostCount = 1n << BigInt(128 - prefix);
  const lastAddress = network + hostCount - 1n;

  return {
    family,
    ip: `${ipv6ToCompressed(ipNum)}/${prefix}`,
    network: `${ipv6ToCompressed(network)}/${prefix}`,
    networkExpanded: ipv6ToExpanded(network),
    lastAddress: ipv6ToCompressed(lastAddress),
    addresses: formatBigInt(hostCount),
  };
}

function ResultItem({ label, value }) {
  return (
    <div>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', marginTop: 2, wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text' }}>{value}</div>
    </div>
  );
}

export default function SubnetTool() {
  const [input, setInput] = useState('192.168.0.1/24');

  const result = useMemo(() => calcSubnet(input), [input]);

  return (
    <Flex vertical gap={12}>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="示例: 192.168.0.1/24 或 2001:db8::1/64"
      />
      <Typography.Text type="secondary">
        支持带掩码与不带掩码输入，默认 IPv4 使用 /32，IPv6 使用 /128
      </Typography.Text>

      {result.error ? (
        <Typography.Text type="danger">{result.error}</Typography.Text>
      ) : (
        <Card size="small">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <ResultItem label="IP 版本" value={result.family} />
            <ResultItem label="标准输入" value={result.ip} />
            <ResultItem label="网络地址" value={result.network} />

            {result.family === 'IPv4' ? (
              <>
                <ResultItem label="子网掩码" value={result.netmask} />
                <ResultItem label="广播地址" value={result.broadcast} />
                <ResultItem label="首个可用主机" value={result.firstHost} />
                <ResultItem label="最后可用主机" value={result.lastHost} />
                <ResultItem label="可用主机数" value={result.hosts} />
              </>
            ) : (
              <>
                <ResultItem label="展开网络地址" value={result.networkExpanded} />
                <ResultItem label="最后地址" value={result.lastAddress} />
                <ResultItem label="地址总量" value={result.addresses} />
              </>
            )}
          </Space>
        </Card>
      )}
    </Flex>
  );
}
