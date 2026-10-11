# Защита OQIM: речь, показ и вопросы

7 минут выступления, потом 3 минуты вопросов. Говорим по-английски (текст ниже можно читать как есть), подсказки для себя по-русски. Режим: **Startup** (сказать вслух в начале, правила это требуют).

Кто говорит (так же в заметках к слайдам): **Amal** слайды 1, 2, 10, 11 (около 2:30), **Komronbek** слайды 3 to 5 и весь показ за ноутбуком (около 2:10), **Aziza** слайды 6 to 9 (около 2:20). Komronbek всё время за ноутбуком и переключает вкладки.

## За 10 минут до выхода

Открыть в Chrome на ноутбуке, каждую в своей вкладке, в этом порядке:

1. https://oqim-audit.vercel.app/tracker : дать загрузиться, нажать Pause, ползунок поставить на начало.
2. https://oqim-audit.vercel.app/parking : дождаться, пока детектор посчитает первый кадр (внизу строка "detector runs ... in N s"). На рабочем столе держать 1 своё фото парковки (сфотографировать любую парковку у WIUT заранее, сверху и издалека лучше всего).
3. https://oqim-audit.vercel.app/city : открыть заранее, карта считается 10 to 15 секунд.
4. https://oqim-audit.vercel.app/banner : нажать пример **C3905** и "Count the vehicles", дождаться результата (около 45 секунд) и не закрывать вкладку. На защите только нажимаем Play на видео.
5. Презентация: `deck/OQIM_defence.pdf` в полноэкранном режиме.

Если интернет плохой: слайды 3, 6, 7, 8 уже со скриншотами, показываем по ним и говорим "the live page is at the link".

## Речь по слайдам (7:00)

### Слайд 1. Титул. Amal, 0:00 to 0:15

> Good morning. We are team PariVision from Webster University in Tashkent: Amal, Komronbek and Aziza. Our mode is Startup. OQIM is a parking tracker. It uses cameras that already watch car parks to tell a driver where a free space will be when they get there.

### Слайд 2. Проблема. Amal, 0:15 to 0:50

> A driver picks a car park by habit, finds it full at the gate, and drives on. While they search, that car is part of the traffic. INRIX found US drivers spend 17 hours a year looking for parking. Only about 5% of off-street car parks publish their free spaces. Tashkent is starting paid street parking, 13,208 spaces on 86 streets, first come, first served. Where cities show drivers the free space, it works: SFpark cut cruising by half on its pilot blocks.

### Слайд 3. Демо 1: трекер. Komronbek, 0:50 to 2:00

Переключиться на вкладку /tracker и нажать Play.

> These are three real car park cameras from the PKLot dataset, one frame every five minutes, one morning each. Watch the big car park fill up. Every space is green or red, read from the camera frame. When a space turns red, a car came in. When it turns green, a car left.
>
> The dataset labels only part of each car park. The dashed spaces have no label: the tracker found them itself, wherever a car stayed for twenty minutes. That is 198 more spaces.
>
> Now the useful part. On the right: which car park to drive to. It does not show the free spaces now, it shows how many will be free when you arrive, and the chance of a space.

Ползунок на 10:13 (как на слайде). Показать блок "Many drivers asking at the same time" (40 водителей): навигатор 17 из 40 к полной парковке, OQIM 4 из 40.

> And when forty drivers ask at the same moment, a navigator sends all of them to the nearest car park. Look how many find it full. OQIM places them one by one, counting the drivers it already sent, and almost nobody finds a full car park.

### Слайд 4. Цифры трекера. Komronbek, 2:00 to 2:30

> How good is it? Against the dataset's hand labels: 98.8% of 6,844 space readings are right. The free count is off by one space in the median. The forecast ten minutes ahead is off by 3.0 spaces, against 4.6 if you just assume "same as now".

### Слайд 5. Как устроено. Komronbek, 2:30 to 3:00

> One pipeline for every page. A camera frame, a detector, YOLO, that finds cars, buses and trucks, small tiles so the far rows are seen too, then free or taken for each space, then the forecast, then the advice. The detector runs in the browser, on WebGPU or WebAssembly. No GPU server, no video stored, no number plates or faces read.

### Слайд 6. Демо 2: своё фото. Aziza, 3:00 to 3:35

Вкладка /parking, кнопка "Choose a photo", выбрать своё фото.

> This is the part you can try on your own photo. We upload a photo of a car park. Nobody marks the spaces by hand: every car it finds is a taken space, and every gap in a row of cars that fits a car is a free one. A wrong one, I click it away.
>
> On the 240 PKLot images we did not tune on, it gets 97.4% of the marked spaces right.

### Слайд 7. Демо 3: район. Aziza, 3:35 to 4:15

Вкладка /city.

> One district at scale: Kwun Tong in Hong Kong. The government publishes 22 traffic cameras and the free spaces of the car parks, live. We count the vehicles on every camera; here are all of them, with what the detector found. Drivers looking for parking get the car park and the route that cost least, counting the other drivers. In our snapshot on the slide, sending everyone to the nearest car park put 60 drivers in front of a full one; with OQIM it was 5. The live page shows today's numbers, so they differ.

### Слайд 8. Демо 4: рекламные щиты. Aziza, 4:15 to 4:50

Вкладка /banner, где пример уже посчитан. Нажать Play.

> The same cameras give a second product. Outdoor advertising companies need proof of how many vehicles pass a billboard. We draw one line in front of the billboard. Every vehicle is counted once, when it crosses the line, by type and direction. Watch: each one turns green and the counter goes up, so every count can be checked by eye, and these two buttons correct it. The counts go to a log for each billboard, and the statistics build up hour by hour.
>
> Against our heavier offline pipeline: 130 of 130 vehicles at midday, 55 of 59 at dusk.

### Слайд 9. Следующий этап. Aziza, 4:50 to 5:20

> The next stage uses the same cameras on traffic lights. From one video of a junction we read the lights and every vehicle, and test signal plans on a replay of that junction. One honest result: the textbook Webster plan was worse than today's timing on all four clips. Our predictive control cut the wait by 13 to 18% on two of them. It is on the site at /audit, with a green wave in 3D and a road damage map.

### Слайд 10. Кто платит. Amal, 5:20 to 6:25

> Who pays: car park operators, for full spaces and less queueing at the gate; the city, for less searching traffic; advertising companies, for counted traffic at each billboard. We price per camera, or per billboard, per month, and set the price in the pilot. Value for an operator is the extra spaces filled times hours times tariff, plus drivers no longer turned away at the gate. Our costs are small: three engineers part time, static hosting from free to about 20 dollars a month, no GPU server and no sensors in the ground. The first step is a three month pilot on one operator's own cameras. Every number on this slide is an assumption to check with that operator, and we will state payback from the pilot, not before.

### Слайд 11. Команда и просьба. Amal, 6:25 to 7:00

> We are three students who built this in the final, on top of our elimination system, and we say what we reused. What we ask for: one car park operator in Tashkent with cameras, for a pilot. Thank you. Everything is live at oqim-audit.vercel.app, and the code is on GitHub.

## Вопросы (3:00)

Отвечать коротко: 2 or 3 предложения, одна цифра, при необходимости открыть запасной слайд (B1 to B6, после слайда 11).

**1. How accurate is it, and how did you measure it?** (B1)
Against hand labels, not against ourselves. On the tracker frames 98.8% of 6,844 space readings are right. On 240 PKLot images we did not tune on, 97.4% of 13,447 spaces, precision 99.1%, recall 95.3%.
*По-русски: точность меряли по ручной разметке; 97,4% на отложенных картинках, на которых ничего не подбирали.*

**2. Which numbers are real and which are simulated?** (B2)
Real: PKLot frames and hand labels, Hong Kong cameras and car park vacancy, the organisers' junction videos. Simulated: the drivers on /city, the drive and walk times on /tracker, the replay of signal plans. Every page says which is which.
*Реальные данные: кадры, разметка, камеры. Смоделированы: водители и их маршруты, время в пути.*

**3. Each car park was recorded on a different day. Isn't the tracker a fake?**
The frames and labels are real; we only play three recorded mornings on one clock, and the page says so. The counts were computed from those frames before; the forecast and the advice run live in the page.
*Кадры настоящие; мы только запускаем три утра на одних часах, это написано на странице.*

**4. How do you find spaces nobody labelled?**
A space is wherever a vehicle stays in one place for 20 minutes. On the labelled part the same method finds 139 of the 142 spaces that cars used. A space nobody parked in that morning cannot be found this way.
*Место там, где машина стоит 20 минут; на размеченной части метод нашёл 139 из 142.*

**5. And on one photo?**
Every car is a taken space; a gap in a row of cars that fits a car is a free one. On 336 PKLot images, 88% of taken spaces are found and 84% of suggested free spaces are free. Those settings were picked on the same images, so it is not a held-out number. An empty row cannot be seen in one photo; you click it in.
*Честно: настройки подобраны на тех же картинках.*

**6. How does the forecast work?**
Spaces taken now, plus the trend: half from the last 20 minutes, half from the same car park's usual weekday morning. Checked against the hand labels of the frame ten minutes later: 3.0 spaces off, against 4.6 for "same as now".

**7. How exact is the billboard count?**
In the browser it matched our heavier offline pipeline on 130 of 130 vehicles at midday and 55 of 59 at dusk. That is two models agreeing, not a hand count. For a client report, a person watches the replay: each counted car turns green, and missed ones are added with one click. The log keeps how many corrections were needed.
*Это совпадение двух моделей, не ручной подсчёт; для отчёта человек проверяет и правит кнопками.*

**8. What about night and rain?** (B3)
PKLot has rain and cloud: rainy frames 96.1%, cloudy 99.0%, sunny 97.0%. It has no night frames, so night is not measured. The billboard count drops at dusk, 55 of 59.

**9. Privacy?** (B3)
The detector runs in the browser on the visitor's machine; the video or photo is not uploaded. We only look for vehicles, we do not read number plates or faces, and we keep counts, not images.
*Видео никуда не загружается, номера и лица не читаем.*

**10. Does it need a GPU server? What does it cost?** (B4)
No. The detector is a 10 MB or 38 MB model that runs in the browser, so the site is static files. A car park needs one frame a minute from a camera it already has.

**11. Why not ground sensors?**
A sensor costs money for every space and has to be put into the ground. One camera covers a whole car park, and many car parks already have one.

**12. How does it scale to Tashkent?** (B5)
Tashkent is starting paid street parking, 13,208 spaces on 86 streets. The city is also connecting its junctions to a control centre: 125 of about 1,000 so far, 545 planned for 2026. The same cameras serve parking, billboards and, later, the lights.

**13. What did you reuse from the elimination?** (B6)
The in-browser detector, the ONNX worker and the tracker port come from our elimination system, and the README says so. Built in the final: the tracker, the forecast, the advice, the whole car park method, the photo suggestion, the billboard counter, the district model and the signal audit.

**14. Who is your customer, and who pays?** (slide 10)
Car park operators of malls, business centres and hospitals, who want full spaces and no queue at the gate; the city; outdoor advertising companies for the billboard counts. First a three month pilot on one operator's cameras. Prices on the slide are our assumptions.

**15. What is your competitive advantage?**
Others use sensors or show the free spaces now. We use existing cameras, forecast the minute you arrive, and spread drivers so they do not all go to the same car park. And it runs in a browser, with no server to buy.

**16. Why Hong Kong and Curitiba, not Tashkent?**
We needed open, legal data: Hong Kong publishes its cameras and car park vacancy, PKLot is a public dataset with hand labels. Tashkent's parking cameras are not public yet; that is exactly what the pilot is for.

**17. What happens if the camera moves or is blocked?**
The spaces are tied to the camera's view, so a moved camera needs its spaces found again; with the "where cars stay" method that takes one busy morning. A blocked view would show up as a sudden drop in cars; flagging it automatically is not built yet.

**18. What was the hardest part?**
Small cars in the far rows. The detector missed most of them until we cut the top of the frame into 5 x 5 tiles and enlarged each one; then the far rows were found too.

Если не знаем ответа: "We have not measured that yet. It is on our list for the pilot." Не придумывать цифры.

## Если что-то сломалось

- Страница не грузится: показать скриншот на слайде, сказать адрес страницы.
- Детектор долго качается: на /parking и /banner модель 10 or 38 MB; поэтому всё открыто заранее.
- Время вышло: пропустить слайд 9 (следующий этап), сразу слайд 10 и 11.
