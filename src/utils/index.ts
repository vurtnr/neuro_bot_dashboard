export interface MinuteLevelPoint {
  time: string;
  irradiance: number;
  windSpeed: number;
}

export function generateMinuteLevelData(): MinuteLevelPoint[] {
  const data = [];
  let currentWind = 2.5; // 初始风速

  for (let i = 0; i < 1440; i++) {
    const hour = Math.floor(i / 60);
    const minute = i % 60;
    const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

    // 1. 模拟辐照度 (Irradiance) - 单峰大波浪
    let irradiance = 0;
    // 假设 06:00 (i=360) 日出，18:00 (i=1080) 日落
    if (i > 360 && i < 1080) {
      // 使用单一日照包络曲线，12:00 附近达到单峰
      const progress = (i - 360) / 720;
      const envelope = Math.pow(Math.sin(progress * Math.PI), 1.22);
      irradiance = envelope * 980;

      // 小幅扰动增强真实感，但不制造二次波峰
      irradiance += 12 * Math.sin(2 * Math.PI * progress + 0.35) + 4 * Math.sin(6 * Math.PI * progress + 0.9);

      if (irradiance < 0) irradiance = 0;
    }

    // 2. 模拟风速 (Wind Speed)
    // 白天受热力驱动风速变大，夜间变小
    const baseWind = hour >= 8 && hour <= 16 ? 4.5 : 2.5;

    // 使用随机游走(Random Walk)模拟风的连贯性和高频突变
    currentWind += (Math.random() - 0.5) * 1.2;

    // 向基准风速收敛，防止偏移过多
    currentWind += (baseWind - currentWind) * 0.1;

    // 限制极端值
    if (currentWind < 0.5) currentWind = 0.5 + Math.random();
    if (currentWind > 12) currentWind = 10 + Math.random();

    data.push({
      time: timeStr,
      irradiance: Number(irradiance.toFixed(1)),
      windSpeed: Number(currentWind.toFixed(1)),
    });
  }

  return data;
}
