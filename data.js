// Film Development Database
const filmDatabase = {
    'tri-x-400': {
        name: 'Kodak Tri-X 400',
        iso: 400,
        type: 'B&W Negative',
        description: 'Classic high-speed black and white film with excellent latitude and distinctive grain structure. Perfect for street photography and low light conditions.',
        characteristics: 'High contrast, excellent push capability, iconic grain pattern',
        developers: {
            'd76': { time: 8.0, dilution: '1:1', temp: 20 },
            'hc110': { time: 6.5, dilution: '1:31', temp: 20 },
            'id11': { time: 8.5, dilution: '1:1', temp: 20 },
            'rodinal': { time: 9.0, dilution: '1:25', temp: 20 },
            'xtol': { time: 7.0, dilution: '1:1', temp: 20 }
        }
    },
    'hp5-400': {
        name: 'Ilford HP5 Plus 400',
        iso: 400,
        type: 'B&W Negative',
        description: 'Versatile black and white film with excellent exposure latitude. Known for smooth tonal gradation and fine grain structure.',
        characteristics: 'Smooth tonality, excellent latitude, fine grain for 400 speed',
        developers: {
            'd76': { time: 9.0, dilution: '1:1', temp: 20 },
            'hc110': { time: 7.0, dilution: '1:31', temp: 20 },
            'id11': { time: 9.5, dilution: '1:1', temp: 20 },
            'ilfosol3': { time: 6.0, dilution: '1:9', temp: 20 },
            'microphen': { time: 7.5, dilution: '1:1', temp: 20 }
        }
    },
    'tmax-400': {
        name: 'Kodak T-Max 400',
        iso: 400,
        type: 'B&W Negative',
        description: 'Modern tabular grain technology provides exceptional sharpness and fine grain. Ideal for enlargements and detailed work.',
        characteristics: 'Extremely fine grain, high sharpness, excellent shadow detail',
        developers: {
            'd76': { time: 7.0, dilution: '1:1', temp: 20 },
            'hc110': { time: 6.0, dilution: '1:31', temp: 20 },
            'xtol': { time: 6.5, dilution: '1:1', temp: 20 },
            'tmax': { time: 6.0, dilution: '1:4', temp: 20 }
        }
    },
    'delta-400': {
        name: 'Ilford Delta 400',
        iso: 400,
        type: 'B&W Negative',
        description: 'Professional black and white film with core-shell crystal technology. Delivers exceptional image quality with fine grain.',
        characteristics: 'Ultra-fine grain, high acutance, excellent tonal range',
        developers: {
            'id11': { time: 8.5, dilution: '1:1', temp: 20 },
            'ilfosol3': { time: 5.5, dilution: '1:9', temp: 20 },
            'microphen': { time: 7.0, dilution: '1:1', temp: 20 },
            'perceptol': { time: 12.0, dilution: '1:1', temp: 20 }
        }
    },
    'fp4-125': {
        name: 'Ilford FP4 Plus 125',
        iso: 125,
        type: 'B&W Negative',
        description: 'Medium speed black and white film offering an excellent balance of fine grain, sharpness and tonal reproduction.',
        characteristics: 'Fine grain, excellent sharpness, smooth tonal gradation',
        developers: {
            'd76': { time: 7.5, dilution: '1:1', temp: 20 },
            'id11': { time: 8.0, dilution: '1:1', temp: 20 },
            'ilfosol3': { time: 5.0, dilution: '1:9', temp: 20 },
            'perceptol': { time: 10.0, dilution: '1:1', temp: 20 }
        }
    },
    'tmax-100': {
        name: 'Kodak T-Max 100',
        iso: 100,
        type: 'B&W Negative',
        description: 'Extremely fine grain black and white film with outstanding sharpness. Perfect for detailed photography and large enlargements.',
        characteristics: 'Finest grain available, maximum sharpness, excellent contrast',
        developers: {
            'd76': { time: 6.0, dilution: '1:1', temp: 20 },
            'hc110': { time: 5.0, dilution: '1:31', temp: 20 },
            'xtol': { time: 5.5, dilution: '1:1', temp: 20 },
            'tmax': { time: 5.0, dilution: '1:4', temp: 20 }
        }
    },
    'acros-100': {
        name: 'Fuji Acros 100',
        iso: 100,
        type: 'B&W Negative',
        description: 'Ultra-fine grain black and white film with exceptional reciprocity characteristics. Ideal for long exposures.',
        characteristics: 'Ultra-fine grain, excellent reciprocity, high resolution',
        developers: {
            'd76': { time: 6.5, dilution: '1:1', temp: 20 },
            'hc110': { time: 5.5, dilution: '1:31', temp: 20 },
            'rodinal': { time: 7.0, dilution: '1:50', temp: 20 },
            'xtol': { time: 6.0, dilution: '1:1', temp: 20 }
        }
    },
    'pan-f-50': {
        name: 'Ilford Pan F Plus 50',
        iso: 50,
        type: 'B&W Negative',
        description: 'Extremely fine grain, slow speed black and white film. Delivers outstanding image quality with maximum detail resolution.',
        characteristics: 'Finest grain, maximum detail, excellent contrast control',
        developers: {
            'id11': { time: 6.5, dilution: '1:1', temp: 20 },
            'ilfosol3': { time: 4.0, dilution: '1:9', temp: 20 },
            'perceptol': { time: 8.0, dilution: '1:1', temp: 20 },
            'microphen': { time: 5.5, dilution: '1:1', temp: 20 }
        }
    }
};

const developerDatabase = {
    'd76': {
        name: 'Kodak D-76',
        type: 'Powder',
        description: 'Classic general-purpose developer providing excellent balance of fine grain, good shadow detail, and normal contrast.',
        characteristics: 'Balanced grain/sharpness, excellent shadow detail, reliable results',
        dilutions: ['1:1', '1:2'],
        shelfLife: 'Stock: 6 months, Working: 24 hours',
        capacity: '120 rolls per liter (stock solution)'
    },
    'hc110': {
        name: 'Kodak HC-110',
        type: 'Liquid Concentrate',
        description: 'Highly concentrated liquid developer offering excellent keeping properties and consistent results across many films.',
        characteristics: 'Long shelf life, consistent results, excellent contrast control',
        dilutions: ['1:31 (Dilution B)', '1:63 (Dilution E)', '1:15 (Dilution A)'],
        shelfLife: 'Concentrate: 2+ years, Working: Single use',
        capacity: 'Single use recommended'
    },
    'id11': {
        name: 'Ilford ID-11',
        type: 'Powder',
        description: 'Fine grain developer similar to D-76, optimized for Ilford films. Provides excellent tonal reproduction.',
        characteristics: 'Fine grain, excellent tonality, optimized for Ilford films',
        dilutions: ['1:1', '1:3'],
        shelfLife: 'Stock: 6 months, Working: 24 hours',
        capacity: '120 rolls per liter (stock solution)'
    },
    'ilfosol3': {
        name: 'Ilford Ilfosol 3',
        type: 'Liquid Concentrate',
        description: 'One-shot liquid developer providing fine grain and excellent sharpness. Easy to use with consistent results.',
        characteristics: 'One-shot convenience, fine grain, excellent sharpness',
        dilutions: ['1:9', '1:14'],
        shelfLife: 'Concentrate: 18 months, Working: Single use',
        capacity: 'Single use only'
    },
    'rodinal': {
        name: 'Agfa Rodinal',
        type: 'Liquid Concentrate',
        description: 'High acutance developer known for exceptional sharpness and edge effects. Creates distinctive grain structure.',
        characteristics: 'Maximum sharpness, edge effects, distinctive grain, long shelf life',
        dilutions: ['1:25', '1:50', '1:100'],
        shelfLife: 'Concentrate: 10+ years, Working: Single use',
        capacity: 'Single use recommended'
    },
    'xtol': {
        name: 'Kodak Xtol',
        type: 'Powder',
        description: 'Ascorbic acid based developer providing fine grain with excellent shadow detail and highlight separation.',
        characteristics: 'Finest grain, excellent shadow detail, environmental friendly',
        dilutions: ['1:1', '1:2', '1:3'],
        shelfLife: 'Stock: 6 months, Working: 24 hours',
        capacity: '120 rolls per liter (stock solution)'
    },
    'microphen': {
        name: 'Ilford Microphen',
        type: 'Powder',
        description: 'Speed-enhancing developer that can increase film speed by up to one stop while maintaining fine grain.',
        characteristics: 'Speed enhancement, fine grain, push processing specialist',
        dilutions: ['1:1', '1:3'],
        shelfLife: 'Stock: 6 months, Working: 24 hours',
        capacity: '120 rolls per liter (stock solution)'
    },
    'perceptol': {
        name: 'Ilford Perceptol',
        type: 'Powder',
        description: 'Ultra-fine grain developer that produces maximum grain refinement with excellent tonal reproduction.',
        characteristics: 'Ultra-fine grain, maximum detail, excellent for enlargements',
        dilutions: ['1:1', '1:3'],
        shelfLife: 'Stock: 6 months, Working: 24 hours',
        capacity: '120 rolls per liter (stock solution)'
    }
};

// Temperature compensation factors (multipliers for development time)
const temperatureCompensation = {
    15: 1.8,
    16: 1.6,
    17: 1.45,
    18: 1.3,
    19: 1.15,
    20: 1.0,   // Standard temperature
    21: 0.9,
    22: 0.8,
    23: 0.72,
    24: 0.65,
    25: 0.6,
    26: 0.55,
    27: 0.5,
    28: 0.46,
    29: 0.42,
    30: 0.38
};

// Push/Pull compensation factors
const pushPullCompensation = {
    '-2': 0.5,   // Pull 2 stops
    '-1': 0.7,   // Pull 1 stop
    '0': 1.0,    // Normal
    '1': 1.4,    // Push 1 stop
    '2': 2.0,    // Push 2 stops
    '3': 2.8     // Push 3 stops
};