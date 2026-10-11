# Защита OQIM: речь, показ и вопросы

По сданной презентации: `deck/submitted/OQIM_defence.pdf` (11 слайдов). 7 минут выступления, потом 3 минуты вопросов. Говорим по-английски (текст ниже можно читать как есть), подсказки для себя по-русски. Режим: **Startup**, сказать вслух на первом слайде, правила это требуют.

Кто говорит: **Amal** слайды 1, 2, 7, 11 (около 1:55), **Komronbek** слайды 3, 6, 8 (около 2:55), **Aziza** слайды 4, 5, 9, 10 (около 2:10). Komronbek всё время за ноутбуком: листает слайды и переключает вкладки, даже когда говорят другие.

В презентации нет двух новых вещей: разметки мест по своему фото и счётчика у рекламного щита. Их показываем живьём на сайте: фото на слайде 4, щит на слайде 8.

## За 10 минут до выхода

Открыть в Chrome на ноутбуке, каждую в своей вкладке, в этом порядке:

1. Презентация `deck/submitted/OQIM_defence.pdf`, полный экран.
2. https://oqim-audit.vercel.app/tracker : дать загрузиться, нажать Pause, ползунок в начало.
3. https://oqim-audit.vercel.app/parking : дождаться, пока детектор посчитает первый кадр (внизу строка "detector runs ... in N s"). На рабочем столе держать своё фото парковки: сфотографировать любую парковку у WIUT заранее, сверху и издалека.
4. https://oqim-audit.vercel.app/city : открыть заранее, карта считается 10 to 15 секунд.
5. https://oqim-audit.vercel.app/banner : нажать пример **C3905**, потом "Count the vehicles", дождаться результата (около минуты) и не закрывать вкладку. На защите нажимаем только Play на видео.

Если интернет плохой: на слайдах 3 и 5 уже есть картинки, показываем по ним и называем адрес страницы.

## Речь по слайдам (7:00)

### Слайд 1. OQIM, титул. Amal, 0:00 to 0:10

> Good morning. We are team PariVision from Webster University in Tashkent. Our mode is Startup. OQIM is a parking tracker built on cameras that already exist.

### Слайд 2. Drivers circle because they cannot see free spaces. Amal, 0:10 to 0:45

> A driver picks a car park by habit, finds it full at the gate, and drives on. While they search, that car is part of the traffic. INRIX found US drivers spend 17 hours a year looking for parking. Only about 5% of off-street car parks publish their free spaces. Tashkent is starting paid parking: 13,208 spaces on 86 streets, first come, first served. Where cities show drivers the free space, it works: SFpark cut cruising by half.

### Слайд 3. Free spaces now, and when you arrive (живой показ /tracker). Komronbek, 0:45 to 2:25

Переключиться на вкладку /tracker и нажать Play.

> These are three real car park cameras from the PKLot dataset, one frame every five minutes, one morning each. Watch the big car park fill up. Every space is green or red, read from the camera frame. When a space turns red, a car came in; when it turns green, a car left.
>
> The dataset labels only part of each car park. The dashed spaces have no label: the tracker found them itself, wherever a car stayed for twenty minutes. That is 198 more spaces.
>
> Against the hand labels, 98.8% of 6,844 space readings are right, and the free count is off by one space in the median.

Ползунок на 10:13. Показать блок "Ask now" и блок "Many drivers asking at the same time" (40 водителей).

> The useful part is on the right: which car park to drive to. It shows how many spaces will be free when you arrive, not now. Ten minutes ahead the forecast is off by 3.0 spaces, against 4.6 if you assume "same as now". And when forty drivers ask at once, a navigator sends all of them to the nearest car park. Look how many find it full. OQIM places them one by one, counting the drivers already sent, and only a few do.

### Слайд 4. 97.4% of spaces right on held-out images (+ своё фото на /parking). Aziza, 2:25 to 3:10

Вкладка /parking, кнопка "Choose a photo", выбрать своё фото.

> The detector, measured on images we did not tune on: 240 PKLot images, 13,447 spaces, 97.4% right. And you can try it on your own photo. Nobody marks the spaces by hand: every car it finds is a taken space, and every gap in a row of cars that fits a car is a free one. A wrong one, I click it away. It all runs in this browser; the photo is not uploaded.

### Слайд 5. A district: drivers spread over the car parks (живой показ /city). Aziza, 3:10 to 3:55

Вкладка /city. Внизу страницы показать стену камер.

> One district at scale: Kwun Tong in Hong Kong. The government publishes 22 traffic cameras and the free spaces of the car parks, live. We count the vehicles on every camera. Here are all of them, with what the detector found. The drivers are simulated; the cameras and the free spaces are real. In our snapshot on the slide, sending everyone to the nearest car park put 60 drivers in front of a full one. With OQIM it was 5, and door to door was 18% faster. The live page shows today's numbers, so they differ.

### Слайд 6. From a camera frame to advice. Komronbek, 3:55 to 4:25

> One pipeline for every page. A camera frame. The detector finds cars, buses and trucks, also on small tiles, so the far rows are seen. Each space is free or taken, and it changes only when two frames agree. Then the forecast, then the advice. The detector runs in the browser: no GPU server, no video stored, no number plates or faces read.

### Слайд 7. Budget and ROI. Amal, 4:25 to 5:05

> All numbers here are our assumptions, to check with the customer. A three month pilot with one car park operator, on cameras it already has. The main cost is people, three engineers part time. Hosting is static, free to 20 dollars a month. No sensors in the ground: one camera covers the spaces it sees. We price per camera per month, set in the pilot. Value for the operator: extra spaces filled times hours times the tariff. We will state payback from the pilot, not before.

### Слайд 8. Why it is hard to copy (+ живой показ /banner). Komronbek, 5:05 to 5:50

> Four reasons. A forecast for the minute you arrive, not only a count. Drivers spread, not herded. Ordinary cameras and a browser tab, no sensor in every space. And the same cameras give more products. Here is one we built today:

Вкладка /banner, где пример уже посчитан. Нажать Play.

> a billboard counter for outdoor advertising. One line in front of the billboard; every vehicle is counted once as it crosses, by type and direction, and turns green, so every count can be checked by eye and corrected with one click. Against our heavier offline pipeline: 130 of 130 vehicles at midday, 55 of 59 at dusk.

### Слайд 9. The same cameras can later time the lights. Aziza, 5:50 to 6:15

> The next stage: traffic lights. From one video of a junction we read the lights and every vehicle, and test signal plans on a replay. The textbook Webster plan was worse than today's timing on all four clips. Our predictive mode cut the wait on one clip from 10.0 to 8.7 seconds.

### Слайд 10. A green wave in 3D, and road damage on a map. Aziza, 6:15 to 6:30

> Later, a green wave on five junctions of Amir Temur Avenue, in a simulation, and a road damage map from phone photos.

### Слайд 11. Team PariVision. Amal, 6:30 to 7:00

> We are Amal, Komronbek and Aziza. Next: a three month pilot with one car park operator in Tashkent, on its own cameras; a live camera instead of a recorded morning; and our own night test set. Everything is live at oqim-audit.vercel.app and the code is on GitHub. Thank you, we are ready for questions.

## Вопросы (3:00)

Отвечать коротко: 2 or 3 предложения и одна цифра. Запасных слайдов в сданной презентации нет, поэтому при необходимости открываем страницу сайта (указана в скобках) или /method, где все правила и цифры.

**1. How accurate is it, and how did you measure it?** (слайд 4, /parking)
Against hand labels, not against ourselves. On 240 PKLot images we did not tune on, 97.4% of 13,447 spaces are right, precision 99.1%, recall 95.3%. On the tracker frames, 98.8% of 6,844 readings.
*По-русски: меряли по ручной разметке; 97,4% на картинках, на которых ничего не подбирали.*

**2. Which numbers are real and which are simulated?**
Real: PKLot frames and hand labels, the Hong Kong cameras and car park vacancy, the organisers' junction videos. Simulated: the drivers on /city, the drive and walk times on /tracker, the replay of signal plans, the green wave. Every page says which is which.
*Реальные: кадры, разметка, камеры. Смоделированы: водители и их маршруты, время в пути, зелёная волна.*

**3. Each car park was recorded on a different day. Isn't the tracker a fake?**
The frames and labels are real. We play three recorded mornings on one clock, and the page says so. The counts were computed from those frames before; the forecast and the advice run live in the page.
*Кадры настоящие, мы только запускаем три утра на одних часах, и это написано на странице.*

**4. How do you find the spaces nobody labelled?**
A space is wherever a vehicle stays in one place for 20 minutes. On the labelled part the same method finds 139 of the 142 spaces that cars used. A space nobody parked in that morning cannot be found this way.

**5. And from one photo?** (/parking)
Every car is a taken space, and a gap in a row of cars that fits a car is a free one. On 336 PKLot images, 88% of taken spaces are found and 84% of suggested free spaces are free. Those settings were picked on the same images, so it is not a held-out number. An empty row cannot be seen in one photo; you click it in.
*Честно: настройки подобраны на тех же картинках.*

**6. How does the forecast work?**
Spaces taken now plus the trend: half from the last 20 minutes, half from the same car park's usual weekday morning. Checked against the hand labels of the frame ten minutes later: 3.0 spaces off, against 4.6 for "same as now".

**7. How exact is the billboard count?** (/banner)
In the browser it matched our heavier offline pipeline on 130 of 130 vehicles at midday and 55 of 59 at dusk. That is two models agreeing, not a hand count. For a client report a person watches the replay: each counted car turns green, and a missed one is added with one click. The log keeps how many corrections were needed.
*Это совпадение двух моделей, а не ручной подсчёт; для отчёта человек проверяет и правит кнопками.*

**8. What about night and rain?**
PKLot has rain and cloud: rainy frames 96.1%, cloudy 99.0%, sunny 97.0%. It has no night frames, so night is not measured; our own night test set is on the list. The billboard count drops at dusk, 55 of 59.

**9. Privacy?**
The detector runs in the browser on the visitor's machine; the video or photo is not uploaded. We look only for vehicles, we do not read number plates or faces, and we keep counts, not images.
*Видео никуда не загружается, номера и лица не читаем.*

**10. Does it need a GPU server? What does it cost?** (слайд 7)
No. The detector is a 10 MB or 38 MB model that runs in the browser, so the site is static files, hosted free to about 20 dollars a month. A car park needs one frame a minute from a camera it already has.

**11. Why not sensors in each space?**
A sensor costs money for every space and has to be put into the ground. One camera covers a whole car park, and many car parks already have one.

**12. How does it scale to Tashkent?** (/elsewhere)
Tashkent is starting paid parking, 13,208 spaces on 86 streets. The city is also connecting its junctions to a control centre: 125 of about 1,000 so far, 545 planned for 2026. The same cameras serve parking, billboards and, later, the lights.

**13. What did you reuse from the elimination?** (README)
The in-browser detector, the ONNX worker and the tracker port come from our elimination system, and the README says so. Built in the final: the parking tracker, the forecast, the advice, the whole car park method, the photo suggestion, the billboard counter, the district model and the signal audit.

**14. Who is your customer, and who pays?** (слайд 7)
Car park operators of malls, business centres and hospitals, who want full spaces and no queue at the gate; the city, for less searching traffic; outdoor advertising companies for the billboard counts. First a three month pilot on one operator's cameras. Prices are our assumptions until the pilot.

**15. What is your competitive advantage?** (слайд 8)
Others use sensors or show the free spaces now. We use existing cameras, forecast the minute you arrive, and spread drivers so they do not all go to the same car park. And it runs in a browser, with no server to buy.

**16. Why Hong Kong and Curitiba, not Tashkent?**
We needed open, legal data: Hong Kong publishes its cameras and car park vacancy, and PKLot is a public dataset with hand labels. Tashkent's parking cameras are not public yet; that is what the pilot is for.

**17. What happens if the camera moves or is blocked?**
The spaces are tied to the camera's view, so a moved camera needs its spaces found again; with the "where cars stay" method that takes one busy morning. A blocked view would show up as a sudden drop in cars; flagging it automatically is not built yet.

**18. What was the hardest part?**
Small cars in the far rows. The detector missed most of them until we cut the top of the frame into 5 x 5 tiles and enlarged each one; then the far rows were found too.

Если не знаем ответа: "We have not measured that yet. It is on our list for the pilot." Не придумывать цифры.

## Если что-то сломалось

- Страница не грузится: показать картинку на слайде и назвать адрес страницы.
- Детектор долго качается: модель на /parking 10 MB, на /banner 38 MB; поэтому всё открыто заранее.
- Время выходит: сократить слайды 9 и 10 до одной фразы и сразу перейти к слайду 11.
