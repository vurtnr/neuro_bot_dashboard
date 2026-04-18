export type SiteStatus = "正常" | "告警";

export interface SiteCardData {
  id: string;
  name: string;
  location: string;
  status: SiteStatus;
  currentPower: string;
  capacity: string;
  imageUrl: string;
  weather: string;
  hint?: string;
}

export const siteCards: SiteCardData[] = [
  {
    id: "qinghai-gonghexian",
    name: "青海场站",
    location: "中国青海，共和县",
    status: "告警",
    currentPower: "25.5",
    capacity: "34.0",
    weather: "晴，17°C",
    hint: "支架NCU N5 参数异常",
    imageUrl:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "alpha",
    name: "Alpha 场站",
    location: "亚利桑那州，沙漠谷",
    status: "正常",
    currentPower: "5.2",
    capacity: "10.0",
    weather: "晴，24°C",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAyK5PEOObAheudNdJP_QM6Y1jkKkU0NvOzE6K0OjLCvqDndut2ySHVnCmSqJdagqGoy1t8GfvFBVaUNausH5K5bAdbXBCTEGLGuncHTtv4WPu49gyKAkqcXBWvfMeTd4emZZbCeE84y0iETpgXsL7VmhoaPV0TG9NxQDzHRy6PLCBuceepImQF5lYUt0IHYdhwgBaJvN1UKNixr7TaEgJ6C74zk3IF_aqg4EuGvrjxej9mRiGOnhmkKcqNaGbuCwc7zA8DH6jI4RTq",
  },
  {
    id: "beta",
    name: "Beta 高地阵列",
    location: "科罗拉多州，绿岭",
    status: "告警",
    currentPower: "2.8",
    capacity: "8.5",
    weather: "多云，18°C",
    hint: "低于预期 15%",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBmepCHay9C5rzT0gv_DTRxrAAOQJS9VgdnhhuCk-JB9rcOd6vcrwedkV37HMuKkYsiyqPMI9oxuSynUS8aTPwSccZquYvouQmTztVzOjJ5edPROik9QUH3YDCQHMr8hUH7FzRXQ_RmOa5nHlgHS-90CMaWigE2nt9Xe93WmcFJylD5eB267CVrOkxui3zipJfR7I84X0ZaFaqJKZ7MxwWYcVwAL91gZI39GyqPD0nAxDlGNlUm4BnKFr_ni13wGbm5gIYxzv69VrQo",
  },
  {
    id: "gamma",
    name: "Gamma 工业园",
    location: "奥斯汀，科技区",
    status: "正常",
    currentPower: "1.2",
    capacity: "1.5",
    weather: "晴，27°C",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCAMM5-5nZ2jXBVTqEOXGhSDVEpr3eWMVUTvDHP9qlNEGCpBJyeR16nfCDo5mFnJ1d59-1DALDbIZOe4nAWHd9TFPF0BUM7scOAxz9DLfRj8LETF_ZpNZrERNeyvPaHGrYMESQHKdK1cVcTZoNqwaMl2J2jXsO6Mee3am11uJe2cH6oeyQh5O_yt4tBVfORV15M0KT1HwHA7rkCqGfNlDHzi-4LXZa_SVRmnw-Bryfn75eCH7Cb3wMUrq0qoQyGA7Lw88NIXQ6VYBug",
  },
];

export function getSiteById(siteId: string) {
  return siteCards.find((site) => site.id === siteId);
}
