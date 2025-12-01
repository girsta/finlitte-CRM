import React, { useState } from 'react';
import { Contract } from '../types';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface CalendarViewProps {
  contracts: Contract[];
}

export default function CalendarView({ contracts }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Convert to 0 = Monday, 1 = Tuesday ... 6 = Sunday for display
    return (day === 0 ? 6 : day - 1);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptySlots = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis",
    "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"
  ];

  // Helper to find contracts expiring on a specific day
  const getContractsForDay = (day: number) => {
    return contracts.filter(c => {
      const d = new Date(c.galiojaIki);
      return !c.is_archived &&
        d.getDate() === day &&
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear();
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
        <h2 className="text-xl font-bold text-gray-900">
          Sutarčių galiojimo kalendorius
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-lg font-medium w-40 text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <div className="flex gap-1">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Calendar Container */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px] h-full flex flex-col">
          {/* Grid Header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 shrink-0 sticky top-0 z-10">
            {['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'].map(day => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {emptySlots.map(slot => (
              <div key={`empty-${slot}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[120px]"></div>
            ))}

            {daysArray.map(day => {
              const dayContracts = getContractsForDay(day);
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

              return (
                <div
                  key={day}
                  className={`
                    min-h-[120px] p-2 border-b border-r border-gray-100 relative group hover:bg-gray-50 transition-colors
                    ${isToday ? 'bg-blue-50/30' : ''}
                  `}
                >
                  <div className={`
                    w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1
                    ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}
                  `}>
                    {day}
                  </div>

                  <div className="space-y-1">
                    {dayContracts.map(c => {
                      const expiryDate = new Date(c.galiojaIki);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPast = expiryDate < today;

                      return (
                        <div
                          key={c.id}
                          className={`text-xs p-1.5 rounded border truncate cursor-pointer hover:opacity-80 mb-1
                            ${isPast
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : 'bg-orange-100 text-orange-800 border-orange-200'
                            }
                          `}
                          title={`${c.draudejas} - ${c.policyNo}`}
                        >
                          <div className="flex items-center gap-1 font-semibold">
                            <AlertCircle size={10} />
                            {isPast ? 'Pasibaigė' : 'Baigiasi'}
                          </div>
                          <div className="truncate">{c.draudejas}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Fill remaining cells to complete the grid row if needed (optional visual polish) */}
            {Array.from({ length: (7 - ((emptySlots.length + daysArray.length) % 7)) % 7 }).map((_, i) => (
              <div key={`fill-${i}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[120px]"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}