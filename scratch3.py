with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CatalogGrid.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_button_class = """                                            className={`
                                                group relative flex flex-col items-start justify-between 
                                                p-3 md:p-4 
                                                min-h-[110px] md:min-h-[140px] lg:min-h-[160px]
                                                w-full rounded-2xl border shadow-xl backdrop-blur-md 
                                                transition-all duration-300 overflow-hidden text-left 
                                                ${!shiftOpen
                                                    ? 'opacity-40 cursor-not-allowed bg-zinc-950/50 border-zinc-900 grayscale'
                                                    : isRecommended
                                                        ? 'bg-gradient-to-br from-park-brand-900/40 to-park-brand-800/20 border-park-brand-500/30 ring-1 ring-park-brand-400/20 hover:border-park-brand-500/60 hover:bg-park-brand-900/50'
                                                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.08] active:bg-white/[0.05] shadow-black/20'
                                                }
                                            `}"""

new_button_class = """                                            className={`
                                                group relative flex flex-col items-start justify-between 
                                                p-4 
                                                min-h-[140px] lg:min-h-[150px]
                                                w-full rounded-xl border-b-4 shadow-md 
                                                transition-all duration-150 overflow-hidden text-left active:translate-y-1 active:border-b-0
                                                ${!shiftOpen
                                                    ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-950 grayscale'
                                                    : p.category === 'POLLOS' || p.category === 'PARRILLA' ? 'bg-orange-600 border-orange-800 hover:bg-orange-500 text-white'
                                                    : p.category === 'BEBIDAS' ? 'bg-blue-600 border-blue-800 hover:bg-blue-500 text-white'
                                                    : p.category === 'GUARNICIONES' ? 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500 text-white'
                                                    : p.category === 'POSTRES' ? 'bg-pink-600 border-pink-800 hover:bg-pink-500 text-white'
                                                    : p.category === 'EXTRAS' ? 'bg-lime-600 border-lime-800 hover:bg-lime-500 text-white'
                                                    : p.category === 'COMBOS' ? 'bg-yellow-500 border-yellow-700 hover:bg-yellow-400 text-park-black'
                                                    : 'bg-zinc-800 border-zinc-950 hover:bg-zinc-700 text-white'
                                                }
                                                ${isRecommended ? 'ring-2 ring-white ring-offset-2 ring-offset-park-black' : ''}
                                            `}"""

old_card_inner = """                                            <div className="flex items-center gap-1.5 md:gap-2 w-full">
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner ${isRecommended ? 'bg-park-brand-500/20' : 'bg-zinc-800/80 group-hover:bg-zinc-700/80 transition-colors'}`}>
                                                    <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isRecommended ? 'text-park-brand-300' : 'text-zinc-400 group-hover:text-zinc-300'} transition-colors`} />
                                                </div>
                                                {!isMobile && (
                                                    <span className={`text-[8px] md:text-[9px] font-bold tracking-wider px-1 md:px-1.5 py-0.5 rounded border ${stationColor} uppercase`}>
                                                        {p.station}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-full mt-auto">
                                                <h3 className="font-semibold text-xs md:text-sm text-zinc-100 leading-tight line-clamp-2 mb-1 group-hover:text-white transition-colors">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-baseline gap-0.5 md:gap-1">
                                                    <span className="text-[10px] md:text-xs text-zinc-500 font-medium">S/</span>
                                                    <span className={`font-mono text-lg md:text-2xl font-black tracking-tight ${isRecommended ? 'text-park-brand-400' : 'text-emerald-400 group-hover:text-emerald-300'} transition-colors drop-shadow-sm`}>
                                                        {formatCents(p.price)}
                                                    </span>
                                                </div>
                                            </div>"""

new_card_inner = """                                            <div className="flex items-center gap-2 w-full">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-inner bg-black/20`}>
                                                    <Icon className={`w-5 h-5 text-current opacity-80`} />
                                                </div>
                                                {!isMobile && (
                                                    <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded bg-black/30 text-white/90 uppercase ml-auto`}>
                                                        {p.station}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-full mt-auto">
                                                <h3 className="font-bold text-sm md:text-base leading-tight line-clamp-2 mb-2 text-current drop-shadow-md">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-baseline gap-1 bg-black/20 px-2 py-1 rounded-md inline-flex">
                                                    <span className="text-xs font-bold text-current opacity-80">S/</span>
                                                    <span className={`font-mono text-lg md:text-xl font-black tracking-tight text-current drop-shadow-sm`}>
                                                        {formatCents(p.price)}
                                                    </span>
                                                </div>
                                            </div>"""

content = content.replace(old_button_class, new_button_class)
content = content.replace(old_card_inner, new_card_inner)

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CatalogGrid.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
