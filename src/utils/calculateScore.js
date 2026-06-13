// Round a number to one decimal place, with a small epsilon to handle floating point precision issues
function roundToOneDecimal(value) {
    return Number((Math.round((value - Number.EPSILON) * 10) / 10).toFixed(1));
}

function calculateProcessScoreAverage(kttx1, kttx2, ktdk1, ktdk2) {
    const processScores = [
        kttx1 !== null ? { value: kttx1, weight: 1 } : null,
        kttx2 !== null ? { value: kttx2, weight: 1 } : null,
        ktdk1 !== null ? { value: ktdk1, weight: 2 } : null,
        ktdk2 !== null ? { value: ktdk2, weight: 2 } : null
    ];

    const totalScore = processScores.reduce(
        (total, item) => total + (item !== null ? (item.value * item.weight) : 0),
        0
    );

    const totalWeight = processScores.reduce(
        (total, item) => total + (item !== null ? item.weight : 0),
        0
    );
    return totalWeight > 0 ? roundToOneDecimal(totalScore / totalWeight) : 0;
}

function calculateAllScores(kttx1, kttx2, ktdk1, ktdk2, ktm1, ktm2) {
    const processScoreAverage = calculateProcessScoreAverage(kttx1, kttx2, ktdk1, ktdk2);
    const examScores = [
        ktm1 !== null ? ktm1 : null,
        ktm2 !== null ? ktm2 : null
    ];

    const totalExamScore = examScores.reduce(
        (total, score) => total + (score !== null ? score : 0), 
        0
    );

    const numberOfFinalScores = examScores.reduce(
        (total, score) => total + (score !== null ? 1 : 0),
        0
    );
    
    const finalScore = roundToOneDecimal(
        processScoreAverage * 0.4 + (numberOfFinalScores > 0 ? ((totalExamScore / numberOfFinalScores) * 0.6) : 0)
    );

    return [processScoreAverage, finalScore];
}

export function processInfo(row) {
    const fullInformation = {
        subjectId: row.subject_id,
        subjectCode: row.subject_code,
        subjectName: row.subject_name,
        subjectOrder: row.subject_order,
        period: row.period,
        kttx1: row.kttx1,
        kttx2: row.kttx2,
        ktdk1: row.ktdk1,
        ktdk2: row.ktdk2,
        ktm1: row.ktm1,
        ktm2: row.ktm2,
    };

    const [processScoreAverage, finalScore] = calculateAllScores(
        fullInformation.kttx1,
        fullInformation.kttx2,
        fullInformation.ktdk1,
        fullInformation.ktdk2,
        fullInformation.ktm1,
        fullInformation.ktm2
    );

    return {
        ...fullInformation,
        processScoreAverage: processScoreAverage,
        finalScore: finalScore
    };
}