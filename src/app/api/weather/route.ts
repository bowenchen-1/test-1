import { NextRequest, NextResponse } from 'next/server';

interface WeatherData {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
}

// 缓存机制
interface CacheData {
  data: WeatherData;
  timestamp: number;
}
const cache = new Map<string, CacheData>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

interface FetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 备选API方案
async function getWeatherFromOpenWeather(city: string): Promise<WeatherData> {
  // 使用OpenWeatherMap API（需要API密钥）
  const API_KEY = process.env.OPENWEATHER_API_KEY;
  if (!API_KEY) {
    throw new Error('OpenWeather API密钥未配置');
  }
  
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`OpenWeather API错误: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    name: data.name,
    main: {
      temp: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      temp_min: Math.round(data.main.temp_min),
      temp_max: Math.round(data.main.temp_max)
    },
    weather: [{
      main: data.weather[0].main,
      description: data.weather[0].description,
      icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
    }],
    wind: {
      speed: Math.round(data.wind.speed * 10) / 10 // 已经是m/s，保留一位小数
    }
  };
}

async function getWeatherFromWeatherAPI(city: string): Promise<WeatherData> {
  // 使用WeatherAPI（需要API密钥）
  const API_KEY = process.env.WEATHERAPI_KEY;
  if (!API_KEY) {
    throw new Error('WeatherAPI密钥未配置');
  }
  
  const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(city)}&lang=zh`;
  
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`WeatherAPI错误: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    name: data.location.name,
    main: {
      temp: Math.round(data.current.temp_c),
      feels_like: Math.round(data.current.feelslike_c),
      humidity: data.current.humidity,
      temp_min: Math.round(data.current.temp_c - 2), // 估算
      temp_max: Math.round(data.current.temp_c + 2)  // 估算
    },
    weather: [{
      main: data.current.condition.text,
      description: data.current.condition.text,
      icon: `https:${data.current.condition.icon}`
    }],
    wind: {
      speed: Math.round(data.current.wind_kph * 0.27778 * 10) / 10 // 转换为m/s
    }
  };
}

async function getWeatherFromWttrIn(city: string): Promise<WeatherData> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, 8000); // wttr.in 可能需要更长时间
  
  if (!response.ok) {
    throw new Error(`wttr.in API错误: ${response.status}`);
  }

  const data = await response.json();
  
  const current = data.current_condition?.[0] || {};
  return {
    name: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
    main: {
      temp: Math.round(parseFloat(current.temp_C || 0)),
      feels_like: Math.round(parseFloat(current.FeelsLikeC || 0)),
      humidity: parseFloat(current.humidity || 0),
      temp_min: Math.round(parseFloat(data.weather?.[0]?.mintempC || current.temp_C || 0)),
      temp_max: Math.round(parseFloat(data.weather?.[0]?.maxtempC || current.temp_C || 0))
    },
    weather: [{
      main: current.weatherDesc?.[0]?.value || '未知',
      description: current.weatherDesc?.[0]?.value || '未知天气',
      icon: current.weatherIconUrl?.[0]?.value || ''
    }],
    wind: {
      speed: Math.round(parseFloat(current.windspeedKmph || 0) * 0.27778 * 10) / 10 // 转换为 m/s
    }
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');

  if (!city) {
    return NextResponse.json(
      { error: '城市名称不能为空' },
      { status: 400 }
    );
  }

  // 检查缓存
  const cacheKey = `weather_${city}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  // API备选方案 - 国内可用优先
  const apis = [
    getWeatherFromOpenWeather,   // 全球CDN，国内可访问
    getWeatherFromWttrIn         // 国外备选
  ];

  for (const api of apis) {
    try {
      const weatherData = await api(city);
      cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
      return NextResponse.json(weatherData);
    } catch (error) {
      console.warn(`${api.name} 失败:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }

  return NextResponse.json(
    { error: '所有天气服务暂时不可用，请稍后重试' },
    { status: 503 }
  );
}