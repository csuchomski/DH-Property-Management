-- Vendors cover counties (not towns), and record where they're based.
-- Properties get a county, filled in from the city when left blank.

alter table public.vendors add column location text check (length(location) <= 120);
comment on column public.vendors.areas is 'Counties the vendor works in (e.g. Waukesha), or all';

alter table public.properties add column county text check (length(county) <= 40);

-- County for a southeast Wisconsin city or village; null when unknown.
create or replace function public.guess_county(p_city text)
returns text language sql immutable set search_path = ''
as $$
  select case lower(trim(regexp_replace(coalesce(p_city, ''), '\.', '', 'g')))
    when 'waukesha' then 'Waukesha' when 'mukwonago' then 'Waukesha' when 'north prairie' then 'Waukesha'
    when 'new berlin' then 'Waukesha' when 'pewaukee' then 'Waukesha' when 'brookfield' then 'Waukesha'
    when 'muskego' then 'Waukesha' when 'oconomowoc' then 'Waukesha' when 'menomonee falls' then 'Waukesha'
    when 'hartland' then 'Waukesha' when 'delafield' then 'Waukesha' when 'sussex' then 'Waukesha'
    when 'elm grove' then 'Waukesha' when 'big bend' then 'Waukesha' when 'eagle' then 'Waukesha'
    when 'dousman' then 'Waukesha' when 'wales' then 'Waukesha' when 'butler' then 'Waukesha'
    when 'lannon' then 'Waukesha' when 'merton' then 'Waukesha' when 'vernon' then 'Waukesha'
    when 'genesee' then 'Waukesha' when 'lisbon' then 'Waukesha' when 'summit' then 'Waukesha'
    when 'chenequa' then 'Waukesha' when 'nashotah' then 'Waukesha' when 'okauchee' then 'Waukesha'
    when 'elkhorn' then 'Walworth' when 'delavan' then 'Walworth' when 'lake geneva' then 'Walworth'
    when 'east troy' then 'Walworth' when 'whitewater' then 'Walworth' when 'williams bay' then 'Walworth'
    when 'fontana' then 'Walworth' when 'fontana-on-geneva lake' then 'Walworth' when 'walworth' then 'Walworth'
    when 'genoa city' then 'Walworth' when 'darien' then 'Walworth' when 'sharon' then 'Walworth'
    when 'lyons' then 'Walworth' when 'bloomfield' then 'Walworth' when 'troy' then 'Walworth'
    when 'sugar creek' then 'Walworth' when 'lafayette' then 'Walworth' when 'pell lake' then 'Walworth'
    when 'milwaukee' then 'Milwaukee' when 'west allis' then 'Milwaukee' when 'wauwatosa' then 'Milwaukee'
    when 'oak creek' then 'Milwaukee' when 'whitefish bay' then 'Milwaukee' when 'shorewood' then 'Milwaukee'
    when 'greenfield' then 'Milwaukee' when 'franklin' then 'Milwaukee' when 'cudahy' then 'Milwaukee'
    when 'south milwaukee' then 'Milwaukee' when 'st francis' then 'Milwaukee' when 'saint francis' then 'Milwaukee'
    when 'greendale' then 'Milwaukee' when 'hales corners' then 'Milwaukee' when 'glendale' then 'Milwaukee'
    when 'fox point' then 'Milwaukee' when 'brown deer' then 'Milwaukee' when 'river hills' then 'Milwaukee'
    when 'bayside' then 'Milwaukee' when 'west milwaukee' then 'Milwaukee'
    when 'racine' then 'Racine' when 'burlington' then 'Racine' when 'waterford' then 'Racine'
    when 'union grove' then 'Racine' when 'mount pleasant' then 'Racine' when 'caledonia' then 'Racine'
    when 'sturtevant' then 'Racine' when 'wind lake' then 'Racine' when 'rochester' then 'Racine'
    when 'kenosha' then 'Kenosha' when 'pleasant prairie' then 'Kenosha' when 'twin lakes' then 'Kenosha'
    when 'paddock lake' then 'Kenosha' when 'salem' then 'Kenosha' when 'bristol' then 'Kenosha'
    when 'silver lake' then 'Kenosha'
    when 'jefferson' then 'Jefferson' when 'fort atkinson' then 'Jefferson' when 'lake mills' then 'Jefferson'
    when 'johnson creek' then 'Jefferson' when 'palmyra' then 'Jefferson' when 'sullivan' then 'Jefferson'
    when 'watertown' then 'Jefferson'
    when 'west bend' then 'Washington' when 'germantown' then 'Washington' when 'hartford' then 'Washington'
    when 'slinger' then 'Washington' when 'jackson' then 'Washington' when 'kewaskum' then 'Washington'
    when 'richfield' then 'Washington'
    when 'mequon' then 'Ozaukee' when 'cedarburg' then 'Ozaukee' when 'grafton' then 'Ozaukee'
    when 'port washington' then 'Ozaukee' when 'thiensville' then 'Ozaukee' when 'saukville' then 'Ozaukee'
    when 'janesville' then 'Rock' when 'beloit' then 'Rock' when 'milton' then 'Rock'
    when 'evansville' then 'Rock' when 'edgerton' then 'Rock' when 'clinton' then 'Rock'
    when 'beaver dam' then 'Dodge' when 'juneau' then 'Dodge' when 'mayville' then 'Dodge'
    when 'horicon' then 'Dodge'
  end;
$$;

create or replace function public.fill_property_county()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if nullif(trim(new.county), '') is null
     or (tg_op = 'UPDATE' and new.city is distinct from old.city and new.county is not distinct from old.county) then
    new.county := coalesce(public.guess_county(new.city), nullif(trim(new.county), ''));
  end if;
  return new;
end;
$$;
create trigger properties_fill_county before insert or update of city, county on public.properties
  for each row execute function public.fill_property_county();

update public.properties set county = public.guess_county(city) where county is null;

-- Any vendor areas saved as towns become counties.
update public.vendors v set areas = coalesce(
  (select array_agg(distinct coalesce(public.guess_county(a), a)) from unnest(v.areas) a), array['all'])
where not v.areas @> array['all'];

revoke execute on function public.fill_property_county() from public, anon, authenticated;
