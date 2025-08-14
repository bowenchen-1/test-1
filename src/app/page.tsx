'use client';

import { useState } from 'react';

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

export default function Home() {
  const [city, setCity] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取天气数据失败');
      }

      setWeatherData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取天气数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">天气查询</h1>
        
        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="请输入城市名称"
              className="input"
            />
            <button
              type="submit"
              disabled={loading}
              className="button"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error">{error}</div>
        )}

        {weatherData && (
          <div className="weather-info">
            <div className="city-name">{weatherData.name}</div>
            <div className="weather-description">{weatherData.weather[0].description}</div>
            
            <div className="grid">
              <div className="card-item blue">
                <div className="card-title">温度范围</div>
                <div className="temp-range">
                  <span className="temp-max">{Math.round(weatherData.main.temp_max)}°</span>
                  <span className="temp-separator">/</span>
                  <span className="temp-min">{Math.round(weatherData.main.temp_min)}°</span>
                </div>
                <div className="current-temp">当前: {Math.round(weatherData.main.temp)}°C</div>
              </div>
              
              <div className="card-item blue">
                <div className="card-title">体感温度</div>
                <div className="card-value">{Math.round(weatherData.main.feels_like)}°C</div>
              </div>
              
              <div className="card-item green">
                <div className="card-title">湿度</div>
                <div className="card-value">{weatherData.main.humidity}%</div>
              </div>
              
              <div className="card-item purple">
                <div className="card-title">风速</div>
                <div className="card-value">{Math.round(weatherData.wind.speed * 10) / 10} m/s</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
