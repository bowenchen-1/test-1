import { NextRequest, NextResponse } from 'next/server';

interface WeatherData {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');

  if (!city) {
    return NextResponse.json(
      { error: '城市名称不能为空' },
      { status: 400 }
    );
  }

  try {
    // 使用免费的 wttr.in API
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`天气API错误: ${response.status}`);
    }

    const data = await response.json();
    
    // 转换 wttr.in 数据格式为前端需要的格式
    const weatherData: WeatherData = {
      name: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
      main: {
        temp: parseFloat(data.current_condition?.[0]?.temp_C || 0),
        feels_like: parseFloat(data.current_condition?.[0]?.FeelsLikeC || 0),
        humidity: parseFloat(data.current_condition?.[0]?.humidity || 0)
      },
      weather: [{
        main: data.current_condition?.[0]?.weatherDesc?.[0]?.value || '未知',
        description: data.current_condition?.[0]?.weatherDesc?.[0]?.value || '未知天气',
        icon: data.current_condition?.[0]?.weatherIconUrl?.[0]?.value || ''
      }],
      wind: {
        speed: parseFloat(data.current_condition?.[0]?.windspeedKmph || 0) * 0.27778 // 转换为 m/s
      }
    };
    
    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('获取天气数据时出错:', error);
    
    return NextResponse.json(
      { error: '获取天气数据失败，请稍后重试' },
      { status: 500 }
    );
  }
}